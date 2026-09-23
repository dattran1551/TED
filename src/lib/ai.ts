import { callQwenMessages, type CallQwenOptions, type ChatCompletionMessage, QwenCallError } from '@/lib/qwenClient'

export class StructuredOutputError extends Error {}

// Model đôi khi bọc JSON trong ```json ... ``` hoặc thêm vài chữ thừa trước/sau
// — bóc phần JSON hợp lệ đầu tiên ra thay vì bắt buộc response phải "sạch"
// tuyệt đối, để không phải retry một cách không cần thiết (tiết kiệm token).
// Tìm khối {...} hoặc [...] cân bằng dấu ngoặc đầu tiên trong chuỗi — không
// chỉ cắt từ dấu mở ngoặc đầu tiên tới hết chuỗi, vì model hay thêm vài chữ
// giải thích/cảm ơn sau khối JSON khiến JSON.parse thất bại vì dư ký tự.
function findBalancedJson(text: string): string | null {
  const openers: Record<string, string> = { '{': '}', '[': ']' }
  const start = text.search(/[{[]/)
  if (start === -1) return null
  const stack: string[] = []
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{' || ch === '[') stack.push(openers[ch])
    else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return null
      if (stack.length === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const jsonSlice = findBalancedJson(candidate)
  if (!jsonSlice) throw new StructuredOutputError('Không tìm thấy JSON trong phản hồi của AI')
  return JSON.parse(jsonSlice)
}

// Gọi AI và ép kết quả về JSON có cấu trúc theo `validate`. Nếu lần đầu
// parse/validate thất bại, thử lại đúng 1 lần với yêu cầu nghiêm ngặt hơn
// trước khi bỏ cuộc — tránh vòng lặp retry vô hạn tốn token.
export async function generateStructured<T>(
  messages: ChatCompletionMessage[],
  validate: (data: unknown) => data is T,
  options?: CallQwenOptions
): Promise<T> {
  const attempt = async (msgs: ChatCompletionMessage[]): Promise<T> => {
    const raw = await callQwenMessages(msgs, options)
    const parsed = extractJson(raw)
    if (!validate(parsed)) {
      throw new StructuredOutputError('AI trả về JSON không đúng cấu trúc mong đợi')
    }
    return parsed
  }

  try {
    return await attempt(messages)
  } catch (err) {
    if (err instanceof QwenCallError) throw err
    try {
      return await attempt([
        ...messages,
        {
          role: 'system',
          content: 'Trả lời CHỈ bằng JSON hợp lệ theo đúng cấu trúc đã yêu cầu, không kèm giải thích, không dùng markdown code fence.',
        },
      ])
    } catch (retryErr) {
      if (retryErr instanceof QwenCallError) throw retryErr
      throw new StructuredOutputError(
        `AI không trả về được JSON hợp lệ sau khi thử lại: ${(retryErr as Error).message}`
      )
    }
  }
}
