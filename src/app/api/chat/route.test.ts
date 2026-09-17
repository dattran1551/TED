import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwenMessages: vi.fn(async () => 'phản hồi giả lập'),
}))

import { callQwenMessages } from '@/lib/qwenClient'
import { GET, POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  testDb.exec('DELETE FROM chat_messages; DELETE FROM chat_conversations;')
  vi.mocked(callQwenMessages).mockReset()
  vi.mocked(callQwenMessages).mockResolvedValue('phản hồi giả lập')
})

describe('POST /api/chat', () => {
  it('trả 400 khi tin nhắn rỗng', async () => {
    const res = await POST(makeRequest({ conversationId: null, message: '   ' }))
    expect(res.status).toBe(400)
  })

  it('tin nhắn đầu tiên tự tạo 1 cuộc chat mới, lưu cả 2 lượt', async () => {
    const res = await POST(makeRequest({ conversationId: null, message: 'viết bài thông báo nghỉ lễ' }))
    expect(res.status).toBe(200)
    const conv = await res.json()
    expect(conv.id).toBeTypeOf('number')
    expect(conv.messages).toHaveLength(2)
    expect(conv.messages[0]).toMatchObject({ role: 'user', content: 'viết bài thông báo nghỉ lễ' })
    expect(conv.messages[1]).toMatchObject({ role: 'assistant', content: 'phản hồi giả lập' })
  })

  it('gửi kèm system prompt và toàn bộ lịch sử hội thoại cho AI', async () => {
    const first = await POST(makeRequest({ conversationId: null, message: 'câu đầu' }))
    const conv1 = await first.json()

    await POST(makeRequest({ conversationId: conv1.id, message: 'câu thứ hai' }))

    const lastCallMessages = vi.mocked(callQwenMessages).mock.calls[1][0]
    expect(lastCallMessages[0].role).toBe('system')
    const contents = lastCallMessages.map((m: any) => m.content)
    expect(contents).toContain('câu đầu')
    expect(contents).toContain('phản hồi giả lập')
    expect(contents).toContain('câu thứ hai')
  })

  it('gửi tiếp tin nhắn vào 1 cuộc chat đã có, không tạo cuộc chat mới', async () => {
    const first = await POST(makeRequest({ conversationId: null, message: 'câu đầu' }))
    const conv1 = await first.json()

    const second = await POST(makeRequest({ conversationId: conv1.id, message: 'câu tiếp theo' }))
    const conv2 = await second.json()

    expect(conv2.id).toBe(conv1.id)
    expect(conv2.messages).toHaveLength(4)
  })

  it('trả 404 khi conversationId không tồn tại', async () => {
    const res = await POST(makeRequest({ conversationId: 9999, message: 'xin chào' }))
    expect(res.status).toBe(404)
  })

  it('khi AI lỗi: không lưu tin nhắn trả lời, vẫn giữ tin nhắn người dùng vừa gửi', async () => {
    vi.mocked(callQwenMessages).mockRejectedValueOnce(new Error('lỗi giả lập'))

    const res = await POST(makeRequest({ conversationId: null, message: 'câu hỏi' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('ai_error')
    expect(body.conversation.messages).toHaveLength(1)
    expect(body.conversation.messages[0]).toMatchObject({ role: 'user', content: 'câu hỏi' })
  })
})

describe('GET /api/chat', () => {
  it('trả về mảng rỗng khi chưa có cuộc chat nào', async () => {
    const res = await GET()
    expect(await res.json()).toEqual([])
  })

  it('trả về danh sách cuộc chat, mới nhất trước', async () => {
    await POST(makeRequest({ conversationId: null, message: 'cuộc chat cũ' }))
    await POST(makeRequest({ conversationId: null, message: 'cuộc chat mới' }))

    const res = await GET()
    const list = await res.json()
    expect(list).toHaveLength(2)
    expect(list[0].preview).toContain('cuộc chat mới')
    expect(list[1].preview).toContain('cuộc chat cũ')
  })
})
