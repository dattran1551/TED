import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { GET, PUT } from './route'

function makePutRequest(body: unknown) {
  return new Request('http://localhost/api/glossary', { method: 'PUT', body: JSON.stringify(body) })
}

describe('GET /api/glossary', () => {
  it('trả về 4 dòng mặc định', async () => {
    const res = await GET()
    const rules = await res.json()
    expect(rules).toHaveLength(4)
  })
})

describe('PUT /api/glossary', () => {
  it('trả 400 khi thiếu trường bắt buộc', async () => {
    const res = await PUT(
      makePutRequest({
        rules: [{ branch: 'hai', xungHo: '', tuVungUuTien: 'x', tuTranh: 'y', nhipCau: 'z', emoji: 'w' }],
      })
    )
    expect(res.status).toBe(400)
  })

  it('lưu thành công khi đủ trường bắt buộc', async () => {
    const res = await PUT(
      makePutRequest({
        rules: [
          {
            branch: 'hai',
            xungHo: 'tao / mày',
            tuVungUuTien: 'x',
            tuTranh: 'y',
            nhipCau: 'z',
            emoji: 'w',
          },
        ],
      })
    )
    expect(res.status).toBe(200)
    const rules = await res.json()
    expect(rules.find((r: any) => r.branch === 'hai').xungHo).toBe('tao / mày')
  })
})
