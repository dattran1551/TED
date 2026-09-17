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
