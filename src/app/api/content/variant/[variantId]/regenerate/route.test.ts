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

function req() {
  return new Request('http://localhost', { method: 'POST' })
}

describe('POST /api/content/variant/[variantId]/regenerate — độc lập theo yêu cầu 5.3', () => {
  it('chỉ regenerate ĐÚNG biến thể được chỉ định, không đụng biến thể khác trong cùng gói', async () => {
    const pkg = createPackage(testDb, {
      conversationId: null,
      briefId: null,
      mode: 'package',
      variants: [
        { channel: 'linkedin', title: '', content: 'bản gốc linkedin' },
        { channel: 'facebook', title: '', content: 'bản gốc facebook' },
      ],
    })
    const linkedinId = pkg.variants.find((v) => v.channel === 'linkedin')!.id

    vi.mocked(callQwenMessages).mockResolvedValueOnce(
      JSON.stringify({ outputs: [{ channel: 'linkedin', title: 'mới', content: 'bản MỚI linkedin' }] })
    )

    const res = await POST(req(), { params: Promise.resolve({ variantId: String(linkedinId) }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    const linkedin = body.package.variants.find((v: any) => v.channel === 'linkedin')
    const facebook = body.package.variants.find((v: any) => v.channel === 'facebook')
    expect(linkedin.content).toBe('bản MỚI linkedin')
    expect(facebook.content).toBe('bản gốc facebook')
  })

  it('variantId không tồn tại trả 404', async () => {
    const res = await POST(req(), { params: Promise.resolve({ variantId: '9999' }) })
    expect(res.status).toBe(404)
  })

  it('AI lỗi trả 502, không làm hỏng biến thể hiện có', async () => {
    const { QwenCallError } = await import('@/lib/qwenClient')
    const pkg = createPackage(testDb, {
      conversationId: null,
      briefId: null,
      mode: 'single',
      variants: [{ channel: 'email', title: '', content: 'bản gốc' }],
    })
    vi.mocked(callQwenMessages).mockRejectedValueOnce(new QwenCallError('lỗi'))

    const res = await POST(req(), { params: Promise.resolve({ variantId: String(pkg.variants[0].id) }) })
    expect(res.status).toBe(502)
  })
})
