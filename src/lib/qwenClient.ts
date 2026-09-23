export class QwenCallError extends Error {}

// Quá thời gian này mà GreenNode chưa trả lời thì bỏ cuộc, để một nhánh treo
// không làm màn hình đứng mãi ở "Đang tạo...". Đây là mặc định cho chat 1
// câu trả lời bình thường — các tác vụ nặng hơn (sinh nhiều kênh cùng lúc)
// cần truyền timeoutMs riêng vì model "reasoning" mất nhiều thời gian "suy
// nghĩ" hơn khi output dài/phức tạp (đo thực tế: 3 kênh có thể vượt 60s).
const DEFAULT_TIMEOUT_MS = 60_000

export type ChatCompletionRole = 'system' | 'user' | 'assistant'

export interface ChatCompletionMessage {
  role: ChatCompletionRole
  content: string
}

export interface CallQwenOptions {
  timeoutMs?: number
}

export async function callQwenMessages(
  messages: ChatCompletionMessage[],
  options?: CallQwenOptions
): Promise<string> {
  const baseUrl = process.env.GREENNODE_BASE_URL || ''
  const apiKey = process.env.GREENNODE_API_KEY || ''
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!baseUrl) {
    throw new QwenCallError('Chưa cấu hình GREENNODE_BASE_URL')
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GREENNODE_MODEL || 'z-ai/glm-5.3-flash-thirdparty',
        messages,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    if ((err as Error)?.name === 'TimeoutError') {
      throw new QwenCallError(`GreenNode không phản hồi kịp thời (quá ${Math.round(timeoutMs / 1000)} giây)`)
    }
    throw new QwenCallError(`Không gọi được GreenNode: ${(err as Error).message}`)
  }

  if (!response.ok) {
    throw new QwenCallError(`GreenNode trả lỗi HTTP ${response.status}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new QwenCallError('GreenNode trả về dữ liệu không đúng định dạng mong đợi')
  }
  return content
}
