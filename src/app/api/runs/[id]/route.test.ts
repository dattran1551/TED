import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createRun, saveOutputResult } from '@/lib/runs'
import type { Run } from '@/types'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { GET } from './route'

function makeRequest(id: string) {
  return new Request(`http://localhost/api/runs/${id}`)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

describe('GET /api/runs/[id]', () => {
  it('trả 404 khi không có lượt nào mang id đó', async () => {
    const res = await GET(makeRequest('9999'), makeParams('9999'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('run_not_found')
  })

  it('trả 404 khi id không phải số', async () => {
    const res = await GET(makeRequest('abc'), makeParams('abc'))
    expect(res.status).toBe(404)
  })

  it('trả về đầy đủ lượt đã có, kèm trạng thái hiện tại của từng nhánh', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai', 're_trung'] }, ['hai', 're_trung'])
    saveOutputResult(testDb, run.outputs[0].id, { status: 'success', content: 'bản hài' })

    const res = await GET(makeRequest(String(run.id)), makeParams(String(run.id)))
    expect(res.status).toBe(200)

    const body: Run = await res.json()
    expect(body.id).toBe(run.id)
    expect(body.inputText).toBe('nội dung mẫu')
    expect(body.outputs).toHaveLength(2)

    const hai = body.outputs.find((o) => o.branch === 'hai')!
    const reTrung = body.outputs.find((o) => o.branch === 're_trung')!
    // Đúng cái mà việc hỏi lại cần thấy: nhánh xong rồi thì đã có nội dung,
    // nhánh chưa xong thì vẫn là 'pending'.
    expect(hai).toMatchObject({ status: 'success', content: 'bản hài' })
    expect(reTrung.status).toBe('pending')
  })
})
