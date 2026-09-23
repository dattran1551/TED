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
import { getLatestQualityCheck } from '@/lib/qualityChecks'
import { POST } from './route'

beforeEach(() => {
  testDb.exec('DELETE FROM quality_checks; DELETE FROM content_variants; DELETE FROM generated_content;')
  vi.mocked(callQwenMessages).mockReset()
})

function req(body: unknown) {
  return new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) })
}

function makeVariant(content = 'nội dung cần kiểm tra') {
  const pkg = createPackage(testDb, {
    conversationId: null,
    briefId: null,
    mode: 'single',
    variants: [{ channel: 'linkedin', title: '', content }],
  })
  return pkg.variants[0].id
}

const PASS_RESULT = {
  overallStatus: 'pass',
  checks: [{ criterion: 'cta', status: 'pass', feedback: 'CTA rõ ràng' }],
  suggestions: [],
  autoFixAvailable: false,
}

const NEEDS_FIX_RESULT = {
  overallStatus: 'needs_improvement',
  checks: [
    { criterion: 'cta', status: 'fail', feedback: 'Thiếu lời kêu gọi hành động' },
    { criterion: 'clarity', status: 'pass', feedback: 'Rõ ràng' },
  ],
  suggestions: ['Thêm CTA'],
  autoFixAvailable: true,
}

describe('POST /api/content/variant/[variantId]/quality-check', () => {
  it('action=run trả kết quả có cấu trúc (không có score giả)', async () => {
    const variantId = makeVariant()
    vi.mocked(callQwenMessages).mockResolvedValueOnce(JSON.stringify(PASS_RESULT))

    const res = await POST(req({ action: 'run' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.qualityCheck.overallStatus).toBe('pass')
    expect(body.qualityCheck).not.toHaveProperty('score')
    expect(getLatestQualityCheck(testDb, variantId)).toBeTruthy()
  })

  it('action=fix khi chưa từng check thì tự chạy check trước rồi mới sửa', async () => {
    const variantId = makeVariant()
    vi.mocked(callQwenMessages)
      .mockResolvedValueOnce(JSON.stringify(NEEDS_FIX_RESULT))
      .mockResolvedValueOnce(JSON.stringify({ title: '', content: 'nội dung đã có CTA' }))

    const res = await POST(req({ action: 'fix' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    const variant = body.package.variants.find((v: any) => v.id === variantId)
    expect(variant.content).toBe('nội dung đã có CTA')
    expect(callQwenMessages).toHaveBeenCalledTimes(2)
  })

  it('action=fix chỉ sửa vấn đề đã liệt kê, giữ nguyên phần khác — prompt nêu rõ feedback failing', async () => {
    const variantId = makeVariant('nội dung gốc')
    vi.mocked(callQwenMessages)
      .mockResolvedValueOnce(JSON.stringify(NEEDS_FIX_RESULT))
      .mockResolvedValueOnce(JSON.stringify({ content: 'đã sửa CTA' }))

    await POST(req({ action: 'fix' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    const fixMessages = vi.mocked(callQwenMessages).mock.calls[1][0]
    expect(fixMessages[0].content).toContain('Thiếu lời kêu gọi hành động')
  })

  it('action=fix khi đã pass hết thì không gọi AI sửa thêm, trả nguyên gói', async () => {
    const variantId = makeVariant()
    vi.mocked(callQwenMessages).mockResolvedValueOnce(JSON.stringify(PASS_RESULT))
    await POST(req({ action: 'run' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    vi.mocked(callQwenMessages).mockReset()

    const res = await POST(req({ action: 'fix' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    expect(res.status).toBe(200)
    expect(callQwenMessages).not.toHaveBeenCalled()
  })

  it('action không hợp lệ trả 400', async () => {
    const variantId = makeVariant()
    const res = await POST(req({ action: 'huy_diet' }), { params: Promise.resolve({ variantId: String(variantId) }) })
    expect(res.status).toBe(400)
  })

  it('variantId không tồn tại trả 404', async () => {
    const res = await POST(req({ action: 'run' }), { params: Promise.resolve({ variantId: '9999' }) })
    expect(res.status).toBe(404)
  })
})
