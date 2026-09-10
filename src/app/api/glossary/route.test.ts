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
  it('trả về 5 dòng mặc định', async () => {
    const res = await GET()
    const rules = await res.json()
    expect(rules).toHaveLength(5)
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

  it('không lưu rule nào nếu có 1 rule không hợp lệ trong cùng request nhiều rule (atomic)', async () => {
    // 'hai' is a real seeded branch. We attempt to change its xungHo to a new,
    // distinguishable value, in the SAME request as an invalid second rule.
    // NOTE: this test runs before 'lưu thành công khi đủ trường bắt buộc' below,
    // which mutates the 'hai' branch — keeping this test first ensures we check
    // against the true pristine seeded default, not a value set by another test.
    const res = await PUT(
      makePutRequest({
        rules: [
          {
            branch: 'hai',
            xungHo: 'GIÁ TRỊ MỚI SẼ KHÔNG ĐƯỢC LƯU',
            tuVungUuTien: 'x',
            tuTranh: 'y',
            nhipCau: 'z',
            emoji: 'w',
          },
          {
            branch: 'chuyen_nghiep',
            xungHo: '', // invalid: missing required field
            tuVungUuTien: 'x',
            tuTranh: 'y',
            nhipCau: 'z',
            emoji: 'w',
          },
        ],
      })
    )

    expect(res.status).toBe(400)

    // The 'hai' rule must NOT have been saved, even though it was valid and
    // came first in the array — this is the atomicity guarantee.
    const getRes = await GET()
    const rules = await getRes.json()
    const haiRule = rules.find((r: any) => r.branch === 'hai')
    expect(haiRule.xungHo).not.toBe('GIÁ TRỊ MỚI SẼ KHÔNG ĐƯỢC LƯU')
    expect(haiRule.xungHo).toBe('tui / bạn') // original seeded default, unchanged
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
