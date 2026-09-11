import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createRun, saveOutputResult, addOutput } from '@/lib/runs'
import { callQwen } from '@/lib/qwenClient'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwen: vi.fn(async () => 'bản đã tạo lại'),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/regenerate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
  vi.mocked(callQwen).mockReset()
  vi.mocked(callQwen).mockResolvedValue('bản đã tạo lại')
})

describe('POST /api/regenerate', () => {
  it('trả 404 khi run không tồn tại', async () => {
    const res = await POST(makeRequest({ runId: 999, outputId: 1, note: 'test' }))
    expect(res.status).toBe(404)
  })

  it('chỉ cập nhật đúng output được yêu cầu, giữ nguyên các output khác', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai', 're_trung'] }, ['hai', 're_trung'])
    const [target, other] = run.outputs

    const res = await POST(makeRequest({ runId: run.id, outputId: target.id, note: 'hài hơn nữa' }))
    expect(res.status).toBe(200)
    const updated = await res.json()

    const updatedTarget = updated.outputs.find((o: any) => o.id === target.id)
    const updatedOther = updated.outputs.find((o: any) => o.id === other.id)
    expect(updatedTarget.status).toBe('success')
    expect(updatedTarget.content).toBe('bản đã tạo lại')
    expect(updatedTarget.regenerateNote).toBe('hài hơn nữa')
    expect(updatedOther.status).toBe('pending')
  })

  it('tạo lại 1 bản dịch thì dùng đúng nội dung nguồn, không phải câu nhập gốc', async () => {
    const run = createRun(testDb, 'CÂU GỐC không được xuất hiện trong prompt dịch', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(testDb, source.id, { status: 'success', content: 'BẢN HÀI ĐÃ CHỌN' })
    const translated = addOutput(testDb, run.id, 'dich_anh', source.id)

    let capturedPrompt = ''
    vi.mocked(callQwen).mockImplementationOnce(async (prompt: string) => {
      capturedPrompt = prompt
      return 'translated text'
    })

    const res = await POST(makeRequest({ runId: run.id, outputId: translated.id, note: '' }))
    expect(res.status).toBe(200)
    expect(capturedPrompt).toContain('BẢN HÀI ĐÃ CHỌN')
    expect(capturedPrompt).not.toContain('CÂU GỐC')
  })
})
