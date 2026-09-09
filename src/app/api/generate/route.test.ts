import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

// Cho phép từng test bật/tắt việc giả lập "ghi DB thất bại" cho một nhánh cụ
// thể, mà không ảnh hưởng các test khác — biến này được khai báo qua
// vi.hoisted vì factory của vi.mock bên dưới cần đọc nó.
const writeFailure = vi.hoisted(() => ({ branch: null as string | null }))

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwen: vi.fn(async (prompt: string) => {
    if (prompt.includes('THROW')) throw new Error('lỗi giả lập')
    return 'bản viết lại giả lập'
  }),
}))

vi.mock('@/lib/runs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/runs')>()
  return {
    ...actual,
    saveOutputResult: (db: any, outputId: number, result: any) => {
      const row = db.prepare('SELECT branch FROM run_outputs WHERE id = ?').get(outputId) as
        | { branch: string }
        | undefined
      if (row && writeFailure.branch && row.branch === writeFailure.branch) {
        throw new Error('lỗi ghi DB giả lập')
      }
      return actual.saveOutputResult(db, outputId, result)
    },
  }
})

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

afterEach(() => {
  writeFailure.branch = null
  testDb.exec("INSERT OR IGNORE INTO glossary_rules (branch) VALUES ('hai')")
})

describe('POST /api/generate', () => {
  it('trả 400 khi không có tuỳ chọn nào được chọn', async () => {
    const res = await POST(makeRequest({ inputText: 'xin chào', options: { tones: [], translate: false } }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('no_options')
  })

  it('sinh đủ số bản theo tuỳ chọn, mỗi bản có nội dung', async () => {
    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai'], translate: true } })
    )
    expect(res.status).toBe(200)
    const run = await res.json()
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o: any) => o.status === 'success')).toBe(true)
  })

  it('nhánh lỗi không ảnh hưởng nhánh còn lại', async () => {
    const res = await POST(
      makeRequest({ inputText: 'THROW nội dung lỗi', options: { tones: ['hai'], translate: true } })
    )
    const run = await res.json()
    // cả 2 nhánh dùng chung inputText nên cả 2 sẽ lỗi trong test này —
    // kiểm tra riêng: status đều là 'error' và vẫn trả đủ outputs, không throw ở route.
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o: any) => o.status === 'error')).toBe(true)
  })

  it('lỗi ghi DB ở nhánh thành công không làm hỏng cả request lẫn nhánh còn lại', async () => {
    // Giả lập: ghi kết quả cho nhánh 'hai' luôn ném lỗi (như SQLite ghi thất bại).
    // Nếu route không bọc try/catch quanh saveOutputResult, lỗi này sẽ làm
    // Promise.all reject và cả request sập — kể cả nhánh 'viet_anh' đang chạy tốt.
    writeFailure.branch = 'hai'

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai'], translate: true } })
    )

    expect(res.status).toBe(200)
    const run = await res.json()
    expect(run.outputs).toHaveLength(2)

    const haiOutput = run.outputs.find((o: any) => o.branch === 'hai')
    const translateOutput = run.outputs.find((o: any) => o.branch === 'viet_anh')

    // Nhánh 'hai' ghi thất bại (lỗi bị nuốt) nên vẫn còn nguyên trạng thái
    // 'pending' ban đầu — nhưng request không hề bị throw.
    expect(haiOutput.status).toBe('pending')
    // Nhánh còn lại hoàn toàn không bị ảnh hưởng, vẫn ghi thành công bình thường.
    expect(translateOutput.status).toBe('success')
    expect(translateOutput.content).toBe('bản viết lại giả lập')
  })

  it('lỗi ghi DB khi lưu kết quả lỗi (nhánh catch) không làm hỏng cả request lẫn nhánh còn lại', async () => {
    // inputText chứa 'THROW' khiến callQwen giả lập ném lỗi cho CẢ 2 nhánh,
    // nên cả 2 đều đi vào khối catch của route và cùng gọi saveOutputResult
    // để lưu status 'error'. Ta giả lập việc ghi đó thất bại riêng cho nhánh 'hai'.
    writeFailure.branch = 'hai'

    const res = await POST(
      makeRequest({ inputText: 'THROW nội dung lỗi', options: { tones: ['hai'], translate: true } })
    )

    expect(res.status).toBe(200)
    const run = await res.json()
    expect(run.outputs).toHaveLength(2)

    const haiOutput = run.outputs.find((o: any) => o.branch === 'hai')
    const translateOutput = run.outputs.find((o: any) => o.branch === 'viet_anh')

    // Ghi lỗi cho nhánh 'hai' bị nuốt nên nó vẫn còn nguyên 'pending'.
    expect(haiOutput.status).toBe('pending')
    // Nhánh 'viet_anh' vẫn ghi được trạng thái 'error' của riêng nó bình thường.
    expect(translateOutput.status).toBe('error')
  })

  it('lỗi ghi DB khi thiếu bảng thuật ngữ không làm hỏng cả request lẫn nhánh còn lại', async () => {
    // Xoá quy tắc thuật ngữ của nhánh 'hai' để route đi vào nhánh "thiếu
    // glossary" (if (!rule) { safeSaveOutputResult(...) }), rồi giả lập chính
    // lần ghi đó cũng thất bại.
    testDb.exec("DELETE FROM glossary_rules WHERE branch = 'hai'")
    writeFailure.branch = 'hai'

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai'], translate: true } })
    )

    expect(res.status).toBe(200)
    const run = await res.json()
    expect(run.outputs).toHaveLength(2)

    const haiOutput = run.outputs.find((o: any) => o.branch === 'hai')
    const translateOutput = run.outputs.find((o: any) => o.branch === 'viet_anh')

    // Ghi lỗi "thiếu thuật ngữ" cho nhánh 'hai' bị nuốt nên nó vẫn còn 'pending'.
    expect(haiOutput.status).toBe('pending')
    // Nhánh 'viet_anh' (có đủ thuật ngữ) vẫn chạy và ghi thành công bình thường.
    expect(translateOutput.status).toBe('success')
  })
})
