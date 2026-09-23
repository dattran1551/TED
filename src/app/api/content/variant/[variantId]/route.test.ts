import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { createPackage } from '@/lib/generatedContent'
import { PATCH } from './route'

beforeEach(() => {
  testDb.exec('DELETE FROM content_variants; DELETE FROM generated_content;')
})

function patchRequest(body: unknown) {
  return new Request('http://localhost', { method: 'PATCH', body: JSON.stringify(body) })
}

describe('PATCH /api/content/variant/[variantId] — sửa thủ công (6.2)', () => {
  it('lưu nội dung người dùng tự sửa, không gọi AI', async () => {
    const pkg = createPackage(testDb, {
      conversationId: null,
      briefId: null,
      mode: 'single',
      variants: [{ channel: 'linkedin', title: 'cũ', content: 'nội dung cũ' }],
    })
    const variantId = pkg.variants[0].id

    const res = await PATCH(patchRequest({ content: 'nội dung đã sửa tay' }), {
      params: Promise.resolve({ variantId: String(variantId) }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const variant = body.package.variants.find((v: any) => v.id === variantId)
    expect(variant.content).toBe('nội dung đã sửa tay')
    expect(variant.status).toBe('edited')
  })

  it('nội dung rỗng bị từ chối', async () => {
    const pkg = createPackage(testDb, {
      conversationId: null,
      briefId: null,
      mode: 'single',
      variants: [{ channel: 'linkedin', title: '', content: 'a' }],
    })
    const res = await PATCH(patchRequest({ content: '   ' }), {
      params: Promise.resolve({ variantId: String(pkg.variants[0].id) }),
    })
    expect(res.status).toBe(400)
  })

  it('variantId không tồn tại trả 404', async () => {
    const res = await PATCH(patchRequest({ content: 'x' }), { params: Promise.resolve({ variantId: '9999' }) })
    expect(res.status).toBe(404)
  })
})
