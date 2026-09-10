import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDb } from '@/lib/db'
import { getRun } from '@/lib/runs'
import { waitForRun } from '@/lib/pendingRuns'
import { BRANCH_LABELS } from '@/types'
import type { Run } from '@/types'

const testDb = createDb(':memory:')

// Cho phép từng test bật/tắt việc giả lập "ghi DB thất bại" cho một nhánh cụ
// thể, mà không ảnh hưởng các test khác — biến này được khai báo qua
// vi.hoisted vì factory của vi.mock bên dưới cần đọc nó.
const writeFailure = vi.hoisted(() => ({ branch: null as string | null }))

// Điều khiển callQwen giả lập. `failMarkers` là các mẩu chữ chỉ xuất hiện
// trong prompt của ĐÚNG một nhánh, nhờ vậy test bắt được nhánh nào hỏng theo
// nhánh chứ không theo nội dung dùng chung. `gate` giữ lời gọi lại giữa chừng
// để kiểm tra route có trả về trước khi các nhánh xong hay không.
const aiControl = vi.hoisted(() => ({
  failMarkers: [] as string[],
  gate: null as null | { promise: Promise<void>; release: () => void },
}))

function openGate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  aiControl.gate = { promise, release }
  return () => aiControl.gate?.release()
}

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwen: vi.fn(async (prompt: string) => {
    if (aiControl.gate) await aiControl.gate.promise
    if (aiControl.failMarkers.some((marker) => prompt.includes(marker))) {
      throw new Error('lỗi giả lập')
    }
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

// Prompt của mỗi nhánh giọng văn có tên giọng văn tiếng Việt riêng — dùng
// chính BRANCH_LABELS để không lặp lại bảng nhãn ở đây.
const HAI_MARKER = `giọng văn: ${BRANCH_LABELS.hai}`
const RE_TRUNG_MARKER = `giọng văn: ${BRANCH_LABELS.re_trung}`

// Đợi phần chạy nền của lượt xong rồi đọc lại từ CSDL — route nay trả về ngay
// khi vừa tạo lượt nên không thể tin vào body của response nữa.
async function settledRun(runId: number) {
  await waitForRun(runId)
  return getRun(testDb, runId)!
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

afterEach(async () => {
  // Nếu một test quên mở cổng thì mở hộ, kẻo việc nền treo mãi.
  aiControl.gate?.release()
  aiControl.gate = null
  aiControl.failMarkers = []
  writeFailure.branch = null
})

describe('POST /api/generate', () => {
  it('trả 400 khi không có tuỳ chọn nào được chọn', async () => {
    const res = await POST(makeRequest({ inputText: 'xin chào', options: { tones: [] } }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('no_options')
  })

  it('sinh đủ số bản theo tuỳ chọn, mỗi bản có nội dung', async () => {
    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    expect(created.outputs).toHaveLength(2)

    const run = await settledRun(created.id)
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o) => o.status === 'success')).toBe(true)
  })

  it('trả về NGAY, mọi nhánh còn pending, không chờ nhánh nào xong', async () => {
    const release = openGate()

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    const created: Run = await res.json()

    // Response tới tay người dùng trong khi cả 2 nhánh vẫn đang bị chặn giữa
    // chừng — đây chính là điều làm cho từng thẻ hiện được "Đang tạo...".
    expect(res.status).toBe(200)
    expect(created.outputs).toHaveLength(2)
    expect(created.outputs.every((o) => o.status === 'pending')).toBe(true)
    // Và CSDL cũng chưa hề có kết quả nào tại thời điểm này.
    expect(getRun(testDb, created.id)!.outputs.every((o) => o.status === 'pending')).toBe(true)

    // Thả cho các nhánh chạy tiếp: kết quả xuất hiện sau đó, đúng chỗ mà việc
    // hỏi lại /api/runs/{id} sẽ đọc được.
    release()
    const run = await settledRun(created.id)
    expect(run.outputs.every((o) => o.status === 'success')).toBe(true)
  })

  it('một nhánh lỗi AI KHÔNG kéo nhánh còn lại lỗi theo', async () => {
    // Chỉ nhánh 'hai' hỏng — nhận diện qua prompt riêng của nhánh đó, chứ
    // không qua inputText (inputText là chung cho mọi nhánh nên không phân
    // biệt được nhánh nào).
    aiControl.failMarkers = [HAI_MARKER]

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    const created = await res.json()
    const run = await settledRun(created.id)

    const hai = run.outputs.find((o) => o.branch === 'hai')!
    const reTrung = run.outputs.find((o) => o.branch === 're_trung')!
    expect(hai.status).toBe('error')
    expect(hai.errorMessage).toBe('lỗi giả lập')
    // Nhánh còn lại vẫn thành công bình thường trong cùng một lượt.
    expect(reTrung.status).toBe('success')
    expect(reTrung.content).toBe('bản viết lại giả lập')
  })

  it('cả hai nhánh cùng lỗi thì request vẫn không sập, vẫn đủ output', async () => {
    aiControl.failMarkers = [HAI_MARKER, RE_TRUNG_MARKER]

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    const run = await settledRun(created.id)

    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o) => o.status === 'error')).toBe(true)
  })

  it('lỗi ghi DB ở nhánh thành công không làm hỏng cả request lẫn nhánh còn lại', async () => {
    // Giả lập: ghi kết quả cho nhánh 'hai' luôn ném lỗi (như SQLite ghi thất bại).
    // Nếu route không bọc try/catch quanh saveOutputResult, lỗi này sẽ làm
    // Promise.all reject và cả việc chạy nền sập — kể cả nhánh 're_trung' đang chạy tốt.
    writeFailure.branch = 'hai'

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    const run = await settledRun(created.id)
    expect(run.outputs).toHaveLength(2)

    const haiOutput = run.outputs.find((o) => o.branch === 'hai')!
    const otherOutput = run.outputs.find((o) => o.branch === 're_trung')!

    // Nhánh 'hai' ghi thất bại (lỗi bị nuốt) nên vẫn còn nguyên trạng thái
    // 'pending' ban đầu — nhưng việc chạy nền không hề bị throw.
    expect(haiOutput.status).toBe('pending')
    // Nhánh còn lại hoàn toàn không bị ảnh hưởng, vẫn ghi thành công bình thường.
    expect(otherOutput.status).toBe('success')
    expect(otherOutput.content).toBe('bản viết lại giả lập')
  })

  it('lỗi ghi DB khi lưu kết quả lỗi (nhánh catch) không làm hỏng nhánh còn lại', async () => {
    // Cả 2 nhánh đều bị AI ném lỗi nên cùng đi vào khối catch của route và
    // cùng gọi saveOutputResult để lưu status 'error'. Ta giả lập việc ghi đó
    // thất bại riêng cho nhánh 'hai'.
    aiControl.failMarkers = [HAI_MARKER, RE_TRUNG_MARKER]
    writeFailure.branch = 'hai'

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    const run = await settledRun(created.id)
    expect(run.outputs).toHaveLength(2)

    const haiOutput = run.outputs.find((o) => o.branch === 'hai')!
    const otherOutput = run.outputs.find((o) => o.branch === 're_trung')!

    // Ghi lỗi cho nhánh 'hai' bị nuốt nên nó vẫn còn nguyên 'pending'.
    expect(haiOutput.status).toBe('pending')
    // Nhánh 're_trung' vẫn ghi được trạng thái 'error' của riêng nó bình thường.
    expect(otherOutput.status).toBe('error')
  })
})
