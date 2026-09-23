import type { ChannelId } from '@/lib/config'
import { CHANNELS, CONTENT_TYPES, LENGTHS, TONES, labelOf } from '@/lib/config'
import type { ContentBrief } from '@/types'

// Khi tạo nội dung qua Composer, brief được tóm tắt thành 1 tin nhắn "user"
// hiển thị trong chat — để dòng thời gian mạch lạc, giống như người dùng vừa
// gõ yêu cầu đó bằng lời (đúng nguyên tắc "composer bổ trợ chat, không thay
// thế chat" ở mục 3.7).
export function summarizeBriefForChat(brief: ContentBrief, channels: ChannelId[]): string {
  const lines = [`📝 Tạo nội dung: ${labelOf(CONTENT_TYPES, brief.contentType)}`]
  lines.push(`Kênh: ${channels.map((c) => labelOf(CHANNELS, c)).join(', ')}`)
  if (brief.tones.length) lines.push(`Giọng văn: ${brief.tones.map((t) => labelOf(TONES, t)).join(', ')}`)
  lines.push(`Độ dài: ${labelOf(LENGTHS, brief.length)}`)
  if (brief.audience) lines.push(`Đối tượng: ${brief.audience}`)
  if (brief.keyMessages) lines.push(`Thông điệp chính: ${brief.keyMessages}`)
  if (brief.cta) lines.push(`CTA: ${brief.cta}`)
  if (brief.additionalContext) lines.push(`Bối cảnh thêm: ${brief.additionalContext}`)
  return lines.join('\n')
}
