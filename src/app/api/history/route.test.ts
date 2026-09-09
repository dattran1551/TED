import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createRun } from '@/lib/runs'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { GET } from './route'

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

describe('GET /api/history', () => {
  it('trả về mảng rỗng khi chưa có lượt nào', async () => {
    const res = await GET()
    expect(await res.json()).toEqual([])
  })

  it('trả về các lượt đã tạo, mới nhất trước', async () => {
    createRun(testDb, 'run cũ', { tones: ['hai'], translate: false }, ['hai'])
    createRun(testDb, 'run mới', { tones: ['hai'], translate: false }, ['hai'])

    const res = await GET()
    const runs = await res.json()
    expect(runs[0].inputText).toBe('run mới')
  })
})
