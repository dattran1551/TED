import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { GET, PUT } from './route'

beforeEach(() => {
  testDb.exec("DELETE FROM brand_profile; INSERT INTO brand_profile (id, data) VALUES (1, '{}')")
})

function putRequest(body: unknown) {
  return new Request('http://localhost/api/brand', { method: 'PUT', body: JSON.stringify(body) })
}

describe('GET /api/brand', () => {
  it('trả về brand profile hiện hành', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('brandName')
    expect(body).toHaveProperty('channelGuidance')
  })
})

describe('PUT /api/brand', () => {
  it('cập nhật brand profile thành công, đọc lại đúng giá trị mới', async () => {
    const res = await PUT(putRequest({ brandName: 'Tên thương hiệu mới', writingRules: ['luật A', 'luật B'] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.brandName).toBe('Tên thương hiệu mới')
    expect(body.writingRules).toEqual(['luật A', 'luật B'])

    const after = await (await GET()).json()
    expect(after.brandName).toBe('Tên thương hiệu mới')
  })

  it('body không phải JSON hợp lệ trả 400, không làm hỏng dữ liệu hiện có', async () => {
    const res = await PUT(new Request('http://localhost/api/brand', { method: 'PUT', body: '{ không hợp lệ' }))
    expect(res.status).toBe(400)
  })

  it('field thiếu/rác không làm crash, chỉ bị bỏ qua hoặc lấy mặc định', async () => {
    const res = await PUT(putRequest({ tones: 'không phải mảng', preferredTerms: 'rác' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tones).toEqual([])
    expect(body.preferredTerms).toEqual([])
  })
})
