import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createRun, saveOutputResult } from '@/lib/runs'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwen: vi.fn(async () => 'bản dịch giả lập'),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/translate', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

describe('POST /api/translate', () => {
  it('trả 404 khi run không tồn tại', async () => {
    const res = await POST(makeRequest({ runId: 999, sourceOutputId: 1, targetBranch: 'dich_anh' }))
    expect(res.status).toBe(404)
  })

  it('trả 400 khi bản nguồn chưa thành công', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const res = await POST(
      makeRequest({ runId: run.id, sourceOutputId: run.outputs[0].id, targetBranch: 'dich_anh' })
    )
    expect(res.status).toBe(400)
  })

  it('tạo 1 output mới cho nhánh dịch, kèm sourceOutputId trỏ về bản đã chọn', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(testDb, source.id, { status: 'success', content: 'bản hài đã chọn' })

    const res = await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_anh' }))
    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated.outputs).toHaveLength(2)
    const translated = updated.outputs.find((o: any) => o.branch === 'dich_anh')
    expect(translated.status).toBe('success')
    expect(translated.content).toBe('bản dịch giả lập')
    expect(translated.sourceOutputId).toBe(source.id)
  })

  it('bấm dịch lần 2 cùng ngôn ngữ thì cập nhật lại đúng thẻ cũ, không tạo thêm', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(testDb, source.id, { status: 'success', content: 'bản hài đã chọn' })

    await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_anh' }))
    const res2 = await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_anh' }))
    const updated = await res2.json()
    const dichAnhOutputs = updated.outputs.filter((o: any) => o.branch === 'dich_anh')
    expect(dichAnhOutputs).toHaveLength(1)
  })

  it('dịch cùng 1 bản sang cả 2 ngôn ngữ thì ra 2 thẻ riêng', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(testDb, source.id, { status: 'success', content: 'bản hài đã chọn' })

    await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_anh' }))
    const res2 = await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_hoa' }))
    const updated = await res2.json()
    expect(updated.outputs).toHaveLength(3)
  })
})
