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

function resolveConfig() {
  const baseUrl = process.env.GREENNODE_BASE_URL || ''
  const apiKey = process.env.GREENNODE_API_KEY || ''
  if (!baseUrl) {
    throw new QwenCallError('Chưa cấu hình GREENNODE_BASE_URL')
  }
  return { baseUrl, apiKey, model: process.env.GREENNODE_MODEL || 'z-ai/glm-5.3-flash-thirdparty' }
}

async function postChatCompletion(
  messages: ChatCompletionMessage[],
  options: CallQwenOptions | undefined,
  stream: boolean
): Promise<Response> {
  const { baseUrl, apiKey, model } = resolveConfig()
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        // Model có chế độ "suy nghĩ" (reasoning) ngầm trước khi trả lời — tắt
        // đi giúp trả lời nhanh hơn đáng kể cho tác vụ đơn giản (đo thực tế:
        // ~44% nhanh hơn), không đổi định dạng response, không tốn thêm phí.
        chat_template_kwargs: { enable_thinking: false },
        stream,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      throw new QwenCallError(`GreenNode trả lỗi HTTP ${response.status}`)
    }
    return response
  } catch (err) {
    if (err instanceof QwenCallError) throw err
    if ((err as Error)?.name === 'TimeoutError') {
      throw new QwenCallError(`GreenNode không phản hồi kịp thời (quá ${Math.round(timeoutMs / 1000)} giây)`)
    }
    throw new QwenCallError(`Không gọi được GreenNode: ${(err as Error).message}`)
  }
}

export async function callQwenMessages(
  messages: ChatCompletionMessage[],
  options?: CallQwenOptions
): Promise<string> {
  const response = await postChatCompletion(messages, options, false)
  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new QwenCallError('GreenNode trả về dữ liệu không đúng định dạng mong đợi')
  }
  return content
}

// Trả về từng mẩu nội dung ngay khi model sinh ra, để khung chat hiện chữ
// dần thay vì đứng im chờ toàn bộ câu trả lời (Feature: streaming chat).
// Model gửi cả "reasoning_content" (phần suy nghĩ ngầm) lẫn "content" (nội
// dung thật) trong cùng 1 stream — CHỈ yield phần content, bỏ qua reasoning,
// người dùng không cần thấy phần "suy nghĩ".
export async function* streamQwenMessages(
  messages: ChatCompletionMessage[],
  options?: CallQwenOptions
): AsyncGenerator<string> {
  const response = await postChatCompletion(messages, options, true)
  if (!response.body) {
    throw new QwenCallError('GreenNode không trả về stream')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') return

        let parsed: unknown
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }
        const content = (parsed as { choices?: { delta?: { content?: string } }[] })?.choices?.[0]?.delta?.content
        if (typeof content === 'string' && content.length > 0) {
          yield content
        }
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError') {
      throw new QwenCallError('GreenNode ngừng phản hồi giữa chừng (quá thời gian chờ)')
    }
    throw new QwenCallError(`Mất kết nối khi đang nhận phản hồi từ GreenNode: ${(err as Error).message}`)
  }
}
