import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('callQwenMessages', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.GREENNODE_BASE_URL = 'https://fake-greennode.test/v1'
    process.env.GREENNODE_API_KEY = 'fake-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.resetModules()
  })

  it('gửi đúng mảng messages truyền vào, không bọc thêm gì', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'trả lời' } }] }),
    })
    global.fetch = fetchMock as any

    const { callQwenMessages } = await import('./qwenClient')
    const messages = [
      { role: 'system' as const, content: 'bạn là trợ lý' },
      { role: 'user' as const, content: 'xin chào' },
    ]
    const result = await callQwenMessages(messages)

    expect(result).toBe('trả lời')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages).toEqual(messages)
  })

  it('tắt chế độ "suy nghĩ" của model để trả lời nhanh hơn (đo thực tế: ~44% nhanh hơn, không đổi định dạng)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'trả lời' } }] }),
    })
    global.fetch = fetchMock as any

    const { callQwenMessages } = await import('./qwenClient')
    await callQwenMessages([{ role: 'user', content: 'x' }])

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false })
  })

  it('ném QwenCallError khi API trả lỗi HTTP', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
  })

  it('ném QwenCallError khi response không đúng định dạng', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
  })

  it('báo lỗi rõ ràng khi chưa cấu hình GREENNODE_BASE_URL, không gọi fetch', async () => {
    process.env.GREENNODE_BASE_URL = ''
    const fetchMock = vi.fn()
    global.fetch = fetchMock as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toThrow(
      'Chưa cấu hình GREENNODE_BASE_URL'
    )
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('đổi lỗi hết giờ chờ thành thông báo tiếng Việt dễ hiểu', async () => {
    const timeoutErr = new Error('The operation was aborted due to timeout')
    timeoutErr.name = 'TimeoutError'
    global.fetch = vi.fn().mockRejectedValue(timeoutErr) as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toThrow('không phản hồi kịp thời')
  })

  it('đổi lỗi kết nối cấp thấp thành QwenCallError có ngữ cảnh', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')) as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toThrow(
      'Không gọi được GreenNode: getaddrinfo ENOTFOUND'
    )
  })

  it('gửi kèm tín hiệu huỷ để không treo vô hạn', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })
    global.fetch = fetchMock as any

    const { callQwenMessages } = await import('./qwenClient')
    await callQwenMessages([{ role: 'user', content: 'x' }])
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})

function makeSseResponse(rawChunks: string[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of rawChunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return { ok: true, body: stream }
}

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  const pieces: string[] = []
  for await (const piece of gen) pieces.push(piece)
  return pieces.join('')
}

describe('streamQwenMessages', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.GREENNODE_BASE_URL = 'https://fake-greennode.test/v1'
    process.env.GREENNODE_API_KEY = 'fake-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.resetModules()
  })

  it('chỉ trả về phần "content", bỏ qua phần "suy nghĩ" (reasoning_content)', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"đang suy nghĩ..."}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Xin"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" chào"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    global.fetch = vi.fn().mockResolvedValue(makeSseResponse(sse)) as any

    const { streamQwenMessages } = await import('./qwenClient')
    const result = await collect(streamQwenMessages([{ role: 'user', content: 'x' }]))
    expect(result).toBe('Xin chào')
  })

  it('ghép đúng dữ liệu dù mạng chia nhỏ 1 khối SSE thành nhiều lần nhận', async () => {
    const full = 'data: {"choices":[{"delta":{"content":"Xin chào"}}]}\n\ndata: [DONE]\n\n'
    const mid = Math.floor(full.length / 2)
    global.fetch = vi.fn().mockResolvedValue(makeSseResponse([full.slice(0, mid), full.slice(mid)])) as any

    const { streamQwenMessages } = await import('./qwenClient')
    const result = await collect(streamQwenMessages([{ role: 'user', content: 'x' }]))
    expect(result).toBe('Xin chào')
  })

  it('bỏ qua 1 dòng JSON hỏng giữa stream, không làm crash toàn bộ', async () => {
    const sse = [
      'data: {hỏng không phải JSON}\n\n',
      'data: {"choices":[{"delta":{"content":"vẫn ổn"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    global.fetch = vi.fn().mockResolvedValue(makeSseResponse(sse)) as any

    const { streamQwenMessages } = await import('./qwenClient')
    const result = await collect(streamQwenMessages([{ role: 'user', content: 'x' }]))
    expect(result).toBe('vẫn ổn')
  })

  it('gửi stream:true trong body khi gọi streamQwenMessages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeSseResponse(['data: [DONE]\n\n']))
    global.fetch = fetchMock as any

    const { streamQwenMessages } = await import('./qwenClient')
    await collect(streamQwenMessages([{ role: 'user', content: 'x' }]))

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.stream).toBe(true)
  })

  it('ném QwenCallError khi API trả lỗi HTTP trước khi bắt đầu stream', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any

    const { streamQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(collect(streamQwenMessages([{ role: 'user', content: 'x' }]))).rejects.toBeInstanceOf(
      QwenCallError
    )
  })

  it('ném QwenCallError nếu response không có body để đọc stream', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, body: null }) as any

    const { streamQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(collect(streamQwenMessages([{ role: 'user', content: 'x' }]))).rejects.toBeInstanceOf(
      QwenCallError
    )
  })

  it('báo lỗi rõ ràng khi chưa cấu hình GREENNODE_BASE_URL, không gọi fetch', async () => {
    process.env.GREENNODE_BASE_URL = ''
    const fetchMock = vi.fn()
    global.fetch = fetchMock as any

    const { streamQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(collect(streamQwenMessages([{ role: 'user', content: 'x' }]))).rejects.toBeInstanceOf(
      QwenCallError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
