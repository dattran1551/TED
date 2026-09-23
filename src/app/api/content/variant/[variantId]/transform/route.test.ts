import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/qwenClient')>()
  return { ...actual, callQwenMessages: vi.fn() }
})

import { callQwenMessages } from '@/lib/qwenClient'
import { createPackage } from '@/lib/generatedContent'
import { POST } from './route'

beforeEach(() => {
  testDb.exec('DELETE FROM content_variants; DELETE FROM generated_content;')
  vi.mocked(callQwenMessages).mockReset()
})

function req(body: unknown) {
  return new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) })
}

function makeVariant() {
  const pkg = createPackage(testDb, {
    conversationId: null,
    briefId: null,
    mode: 'single',
    variants: [{ channel: 'linkedin', title: 'cũ', content: 'nội dung gốc' }],
  })
  return pkg.variants[0].id
}

describe('POST /api/content/variant/[variantId]/transform — Quick Actions (6.3)', () => {
  it('action không hợp lệ trả 400', async () => {
    const variantId = makeVariant()
    const res = await POST(req({ action: 'xoa_het' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    expect(res.status).toBe(400)
  })

  it('rewrite/shorten/more_human... cập nhật ĐÚNG biến thể, trả về gói đã cập nhật', async () => {
    const variantId = makeVariant()
    vi.mocked(callQwenMessages).mockResolvedValueOnce(JSON.stringify({ title: 'mới', content: 'nội dung đã rút ngắn' }))

    const res = await POST(req({ action: 'shorten' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    const variant = body.package.variants.find((v: { id: number }) => v.id === variantId)
    expect(variant.content).toBe('nội dung đã rút ngắn')
    expect(variant.status).toBe('edited')
  })

  it('alternatives trả về NHIỀU phiên bản, KHÔNG ghi đè biến thể gốc', async () => {
    const variantId = makeVariant()
    vi.mocked(callQwenMessages).mockResolvedValueOnce(
      JSON.stringify({ alternatives: ['phiên bản 1', 'phiên bản 2', 'phiên bản 3'] })
    )

    const res = await POST(req({ action: 'alternatives' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alternatives).toHaveLength(3)
    expect(body.package).toBeUndefined()
  })

  it('translate gửi kèm targetLanguage vào AI', async () => {
    const variantId = makeVariant()
    vi.mocked(callQwenMessages).mockResolvedValueOnce(JSON.stringify({ content: 'translated content' }))

    await POST(req({ action: 'translate', targetLanguage: 'English' }), {
      params: Promise.resolve({ variantId: String(variantId) }),
    })
    const sentMessages = vi.mocked(callQwenMessages).mock.calls[0][0]
    expect(sentMessages[0].content).toContain('English')
  })

  it('variantId không tồn tại trả 404', async () => {
    const res = await POST(req({ action: 'rewrite' }), { params: Promise.resolve({ variantId: '9999' }) })
    expect(res.status).toBe(404)
  })
})
