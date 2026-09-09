import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('callQwen', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.GREENNODE_BASE_URL = 'https://fake-greennode.test/v1'
    process.env.GREENNODE_API_KEY = 'fake-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.resetModules()
  })

  it('trả về nội dung khi API thành công', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'bản viết lại' } }] }),
    }) as any

    const { callQwen } = await import('./qwenClient')
    const result = await callQwen('prompt bất kỳ')
    expect(result).toBe('bản viết lại')
  })

  it('ném QwenCallError khi API trả lỗi HTTP', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any

    const { callQwen, QwenCallError } = await import('./qwenClient')
    await expect(callQwen('prompt bất kỳ')).rejects.toBeInstanceOf(QwenCallError)
  })

  it('ném QwenCallError khi response không đúng định dạng', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

    const { callQwen, QwenCallError } = await import('./qwenClient')
    await expect(callQwen('prompt bất kỳ')).rejects.toBeInstanceOf(QwenCallError)
  })
})
