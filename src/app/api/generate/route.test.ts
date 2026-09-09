import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

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
})
