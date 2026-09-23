import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { getConversation } from '@/lib/chat'
import { STREAM_ERROR_MARKER } from '@/lib/chatStreamProtocol'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  streamQwenMessages: vi.fn(),
}))

import { streamQwenMessages } from '@/lib/qwenClient'
import { GET, POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) })
}

async function* replyWith(...pieces: string[]): AsyncGenerator<string> {
  for (const piece of pieces) yield piece
}

async function* replyThenThrow(pieces: string[], err: Error): AsyncGenerator<string> {
  for (const piece of pieces) yield piece
  throw err
}

async function* throwImmediately(err: Error): AsyncGenerator<string> {
  throw err
}

// Đọc trọn response dạng stream giống cách frontend sẽ làm: dòng đầu là JSON
// meta (conversationId), phần sau là chữ trả lời, có thể kèm marker lỗi giữa
// chừng ở cuối.
async function readStream(res: Response): Promise<{ conversationId: number | null; text: string; error: string | null }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    raw += decoder.decode(value, { stream: true })
  }
  const newlineIdx = raw.indexOf('\n')
  const metaLine = raw.slice(0, newlineIdx)
  let rest = raw.slice(newlineIdx + 1)
  let conversationId: number | null = null
  try {
    conversationId = JSON.parse(metaLine).conversationId
  } catch {
    // ignore
  }
  let error: string | null = null
  const errIdx = rest.indexOf(STREAM_ERROR_MARKER)
  if (errIdx !== -1) {
    error = rest.slice(errIdx + STREAM_ERROR_MARKER.length)
    rest = rest.slice(0, errIdx)
  }
  return { conversationId, text: rest, error }
}

beforeEach(() => {
  testDb.exec('DELETE FROM chat_messages; DELETE FROM chat_conversations;')
  vi.mocked(streamQwenMessages).mockReset()
  vi.mocked(streamQwenMessages).mockImplementation(() => replyWith('phản hồi giả lập'))
})

describe('POST /api/chat', () => {
  it('trả 400 khi tin nhắn rỗng', async () => {
    const res = await POST(makeRequest({ conversationId: null, message: '   ' }))
    expect(res.status).toBe(400)
  })

  it('tin nhắn đầu tiên tự tạo 1 cuộc chat mới, stream trả lời rồi lưu cả 2 lượt', async () => {
    const res = await POST(makeRequest({ conversationId: null, message: 'viết bài thông báo nghỉ lễ' }))
    expect(res.status).toBe(200)

    const { conversationId, text, error } = await readStream(res)
    expect(error).toBeNull()
    expect(text).toBe('phản hồi giả lập')

    const conv = getConversation(testDb, conversationId!)!
    expect(conv.messages).toHaveLength(2)
    expect(conv.messages[0]).toMatchObject({ role: 'user', content: 'viết bài thông báo nghỉ lễ' })
    expect(conv.messages[1]).toMatchObject({ role: 'assistant', content: 'phản hồi giả lập' })
  })

  it('hiện dần từng mẩu chữ khi model trả về nhiều đoạn (streaming)', async () => {
    vi.mocked(streamQwenMessages).mockImplementation(() => replyWith('Xin ', 'chào ', 'bạn!'))

    const res = await POST(makeRequest({ conversationId: null, message: 'chào' }))
    const { text } = await readStream(res)
    expect(text).toBe('Xin chào bạn!')
  })

  it('gửi kèm system prompt và toàn bộ lịch sử hội thoại cho AI', async () => {
    const first = await POST(makeRequest({ conversationId: null, message: 'câu đầu' }))
    const { conversationId } = await readStream(first)

    await POST(makeRequest({ conversationId, message: 'câu thứ hai' }))

    const lastCallMessages = vi.mocked(streamQwenMessages).mock.calls[1][0]
    expect(lastCallMessages[0].role).toBe('system')
    const contents = lastCallMessages.map((m) => m.content)
    expect(contents).toContain('câu đầu')
    expect(contents).toContain('phản hồi giả lập')
    expect(contents).toContain('câu thứ hai')
  })

  it('gửi tiếp tin nhắn vào 1 cuộc chat đã có, không tạo cuộc chat mới', async () => {
    const first = await POST(makeRequest({ conversationId: null, message: 'câu đầu' }))
    const { conversationId } = await readStream(first)

    const second = await POST(makeRequest({ conversationId, message: 'câu tiếp theo' }))
    const { conversationId: sameId } = await readStream(second)

    expect(sameId).toBe(conversationId)
    const conv = getConversation(testDb, conversationId!)!
    expect(conv.messages).toHaveLength(4)
  })

  it('trả 404 khi conversationId không tồn tại', async () => {
    const res = await POST(makeRequest({ conversationId: 9999, message: 'xin chào' }))
    expect(res.status).toBe(404)
  })

  it('khi AI lỗi NGAY TỪ ĐẦU: trả JSON lỗi bình thường (chưa kịp stream gì), không lưu tin nhắn trả lời', async () => {
    vi.mocked(streamQwenMessages).mockImplementation(() => throwImmediately(new Error('lỗi giả lập')))

    const res = await POST(makeRequest({ conversationId: null, message: 'câu hỏi' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('ai_error')
    expect(body.conversation.messages).toHaveLength(1)
    expect(body.conversation.messages[0]).toMatchObject({ role: 'user', content: 'câu hỏi' })
  })

  it('khi AI lỗi GIỮA CHỪNG (đã stream được 1 phần): giữ phần chữ đã nhận, đánh dấu lỗi ở cuối, vẫn lưu phần đã có', async () => {
    vi.mocked(streamQwenMessages).mockImplementation(() =>
      replyThenThrow(['Đây là phần đã viết được'], new Error('mất kết nối giữa chừng'))
    )

    const res = await POST(makeRequest({ conversationId: null, message: 'câu hỏi' }))
    // Status không đổi được nữa vì đã bắt đầu stream — vẫn là 200.
    expect(res.status).toBe(200)

    const { conversationId, text, error } = await readStream(res)
    expect(text).toBe('Đây là phần đã viết được')
    expect(error).toContain('mất kết nối giữa chừng')

    const conv = getConversation(testDb, conversationId!)!
    expect(conv.messages[1]).toMatchObject({ role: 'assistant', content: 'Đây là phần đã viết được' })
  })
})

describe('GET /api/chat', () => {
  it('trả về mảng rỗng khi chưa có cuộc chat nào', async () => {
    const res = await GET()
    expect(await res.json()).toEqual([])
  })

  it('trả về danh sách cuộc chat, mới nhất trước', async () => {
    await readStream(await POST(makeRequest({ conversationId: null, message: 'cuộc chat cũ' })))
    await readStream(await POST(makeRequest({ conversationId: null, message: 'cuộc chat mới' })))

    const res = await GET()
    const list = await res.json()
    expect(list).toHaveLength(2)
    expect(list[0].preview).toContain('cuộc chat mới')
    expect(list[1].preview).toContain('cuộc chat cũ')
  })
})
