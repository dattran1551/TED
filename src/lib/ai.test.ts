import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/qwenClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/qwenClient')>()
  return { ...actual, callQwenMessages: vi.fn() }
})

import { callQwenMessages, QwenCallError } from '@/lib/qwenClient'
import { generateStructured, StructuredOutputError } from './ai'

interface Shape {
  content: string
}
function isShape(data: unknown): data is Shape {
  return typeof data === 'object' && data !== null && typeof (data as Record<string, unknown>).content === 'string'
}

beforeEach(() => {
  vi.mocked(callQwenMessages).mockReset()
})

describe('generateStructured', () => {
  it('parse JSON sạch bình thường', async () => {
    vi.mocked(callQwenMessages).mockResolvedValueOnce('{"content": "xin chào"}')
    const result = await generateStructured([], isShape)
    expect(result).toEqual({ content: 'xin chào' })
  })

  it('bóc được JSON bọc trong code fence ```json', async () => {
    vi.mocked(callQwenMessages).mockResolvedValueOnce('```json\n{"content": "trong fence"}\n```')
    const result = await generateStructured([], isShape)
    expect(result).toEqual({ content: 'trong fence' })
  })

  it('bóc được JSON có chữ thừa quanh nó', async () => {
    vi.mocked(callQwenMessages).mockResolvedValueOnce('Đây là kết quả: {"content": "có chữ thừa"} cảm ơn bạn')
    const result = await generateStructured([], isShape)
    expect(result).toEqual({ content: 'có chữ thừa' })
  })

  it('parse lỗi lần đầu thì thử lại đúng 1 lần với yêu cầu nghiêm ngặt hơn', async () => {
    vi.mocked(callQwenMessages)
      .mockResolvedValueOnce('không phải JSON gì cả')
      .mockResolvedValueOnce('{"content": "lần thử lại thành công"}')

    const result = await generateStructured([{ role: 'system', content: 'x' }], isShape)
    expect(result).toEqual({ content: 'lần thử lại thành công' })
    expect(callQwenMessages).toHaveBeenCalledTimes(2)
  })

  it('thất bại cả 2 lần thì ném StructuredOutputError, không lặp vô hạn', async () => {
    vi.mocked(callQwenMessages).mockResolvedValue('vẫn không phải JSON')
    await expect(generateStructured([], isShape)).rejects.toBeInstanceOf(StructuredOutputError)
    expect(callQwenMessages).toHaveBeenCalledTimes(2)
  })

  it('AI provider lỗi (timeout/HTTP) thì báo ngay, không retry bằng prompt nghiêm ngặt hơn', async () => {
    vi.mocked(callQwenMessages).mockRejectedValueOnce(new QwenCallError('GreenNode không phản hồi kịp thời'))
    await expect(generateStructured([], isShape)).rejects.toBeInstanceOf(QwenCallError)
    expect(callQwenMessages).toHaveBeenCalledTimes(1)
  })

  it('JSON đúng cú pháp nhưng sai cấu trúc mong đợi vẫn bị coi là lỗi', async () => {
    vi.mocked(callQwenMessages).mockResolvedValue('{"wrongField": 123}')
    await expect(generateStructured([], isShape)).rejects.toBeInstanceOf(StructuredOutputError)
  })
})
