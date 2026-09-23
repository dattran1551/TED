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
import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/content/generate', { method: 'POST', body: JSON.stringify(body) })
}

function packageResponse(channels: string[]) {
  return JSON.stringify({
    outputs: channels.map((channel) => ({ channel, title: `Tiêu đề ${channel}`, content: `Nội dung cho ${channel}` })),
  })
}

beforeEach(() => {
  testDb.exec(
    'DELETE FROM content_variants; DELETE FROM generated_content; DELETE FROM content_briefs; DELETE FROM chat_messages; DELETE FROM chat_conversations;'
  )
  vi.mocked(callQwenMessages).mockReset()
})

describe('POST /api/content/generate', () => {
  it('trả 400 khi không chọn kênh nào', async () => {
    const res = await POST(makeRequest({ brief: {}, channels: [] }))
    expect(res.status).toBe(400)
  })

  it('trả 400 khi channel không hợp lệ', async () => {
    const res = await POST(makeRequest({ brief: {}, channels: ['tiktok'] }))
    expect(res.status).toBe(400)
  })

  it('sinh gói nội dung cho nhiều kênh trong 1 lần gọi AI duy nhất (yêu cầu 5.6/12)', async () => {
    vi.mocked(callQwenMessages).mockResolvedValueOnce(packageResponse(['linkedin', 'facebook', 'internal']))

    const res = await POST(
      makeRequest({
        brief: { contentType: 'event_recap', keyMessages: 'Campus tour cùng Arena Multimedia' },
        channels: ['linkedin', 'facebook', 'internal'],
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.package.mode).toBe('package')
    expect(body.package.variants).toHaveLength(3)
    expect(callQwenMessages).toHaveBeenCalledTimes(1)
  })

  it('1 kênh duy nhất thì mode = single', async () => {
    vi.mocked(callQwenMessages).mockResolvedValueOnce(packageResponse(['email']))
    const res = await POST(makeRequest({ brief: {}, channels: ['email'] }))
    const body = await res.json()
    expect(body.package.mode).toBe('single')
  })

  it('gói nội dung được gắn vào cuộc hội thoại và xuất hiện lại khi mở lại hội thoại đó', async () => {
    vi.mocked(callQwenMessages).mockResolvedValueOnce(packageResponse(['linkedin']))
    const res = await POST(makeRequest({ brief: {}, channels: ['linkedin'] }))
    const body = await res.json()

    expect(body.conversation.contentPackages).toHaveLength(1)
    expect(body.conversation.contentPackages[0].id).toBe(body.package.id)
    expect(body.conversation.messages.some((m: any) => m.role === 'assistant')).toBe(true)
  })

  it('conversationId không tồn tại trả 404', async () => {
    const res = await POST(makeRequest({ brief: {}, channels: ['linkedin'], conversationId: 9999 }))
    expect(res.status).toBe(404)
  })

  it('AI lỗi provider trả 502 và giữ nguyên tin nhắn user đã lưu', async () => {
    const { QwenCallError } = await import('@/lib/qwenClient')
    vi.mocked(callQwenMessages).mockRejectedValueOnce(new QwenCallError('GreenNode timeout'))

    const res = await POST(makeRequest({ brief: {}, channels: ['linkedin'] }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('ai_error')
    expect(body.conversation.messages).toHaveLength(1)
  })

  it('AI trả JSON sai định dạng (kể cả sau retry) trả 502 ai_bad_response, không crash', async () => {
    vi.mocked(callQwenMessages).mockResolvedValue('không phải JSON hợp lệ')
    const res = await POST(makeRequest({ brief: {}, channels: ['linkedin'] }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('ai_bad_response')
  })

  it('body không phải JSON hợp lệ trả 400', async () => {
    const res = await POST(new Request('http://localhost/api/content/generate', { method: 'POST', body: '{ rác' }))
    expect(res.status).toBe(400)
  })
})
