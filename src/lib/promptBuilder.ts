import type { ChatCompletionMessage } from '@/lib/qwenClient'
import type { BrandProfile, ChatMessage, ContentBrief, ContentVariant } from '@/types'
import { CHANNELS, LENGTHS, TONES, TRANSFORM_ACTIONS, labelOf, type ChannelId, type TransformActionId } from '@/lib/config'

// ---------------------------------------------------------------------------
// Kiến trúc prompt theo lớp (yêu cầu 4.5):
//   SYSTEM INSTRUCTIONS + BRAND CONTEXT + CHANNEL RULES + BRIEF + HỘI THOẠI + YÊU CẦU
// Mỗi lớp là 1 hàm build*Text riêng, ghép lại ở tầng trên cùng (generation/
// transform/quality-check) — không có prompt khổng lồ viết tay 1 chỗ, và
// không lặp logic ghép brand/brief giữa các use-case.
// ---------------------------------------------------------------------------

const BASE_SYSTEM_INSTRUCTIONS =
  'Bạn là TED, trợ lý viết nội dung. Luôn viết đúng bố cục chuẩn ngoài đời thật của loại nội dung được yêu cầu, không thêm lời dẫn thừa như "Đây là nội dung bạn cần" — chỉ đưa thẳng phần nội dung.'

// Không đưa toàn bộ brand profile vào mọi request để tránh tốn token vô ích
// (yêu cầu 4.6/12) — chỉ đưa các trường có giá trị, và channelGuidance chỉ
// lấy đúng kênh đang xử lý.
export function buildBrandContextText(brand: BrandProfile, channel?: ChannelId): string {
  const lines: string[] = []
  if (brand.brandName) lines.push(`Thương hiệu: ${brand.brandName}`)
  if (brand.brandDescription) lines.push(`Mô tả: ${brand.brandDescription}`)
  if (brand.voice) lines.push(`Giọng thương hiệu: ${brand.voice}`)
  if (brand.tones.length) lines.push(`Tông giọng ưu tiên: ${brand.tones.join(', ')}`)
  if (brand.writingRules.length) lines.push(`Quy tắc viết:\n- ${brand.writingRules.join('\n- ')}`)
  if (brand.preferredTerms.length) {
    const terms = brand.preferredTerms
      .map((t) => (t.avoid ? `dùng "${t.preferred}" thay vì "${t.avoid}"` : `ưu tiên dùng "${t.preferred}"`))
      .join('; ')
    lines.push(`Từ ngữ: ${terms}`)
  }
  if (brand.avoidedTerms.length) lines.push(`Tránh dùng các từ/cụm: ${brand.avoidedTerms.join(', ')}`)
  if (brand.ctaGuidance) lines.push(`Hướng dẫn CTA: ${brand.ctaGuidance}`)
  if (brand.hashtagGuidance) lines.push(`Hướng dẫn hashtag: ${brand.hashtagGuidance}`)
  if (channel && brand.channelGuidance[channel]) {
    lines.push(`Riêng cho kênh ${labelOf(CHANNELS, channel)}: ${brand.channelGuidance[channel]}`)
  }
  return lines.length ? `--- BRAND CONTEXT ---\n${lines.join('\n')}` : ''
}

export function buildBriefContextText(brief: ContentBrief): string {
  const lines: string[] = [`Loại nội dung: ${brief.contentType}`]
  if (brief.audience) lines.push(`Đối tượng đọc: ${brief.audience}`)
  if (brief.objective) lines.push(`Mục tiêu: ${brief.objective}`)
  if (brief.tones.length) lines.push(`Giọng văn: ${brief.tones.map((t) => labelOf(TONES, t)).join(', ')}`)
  lines.push(`Độ dài mong muốn: ${labelOf(LENGTHS, brief.length)}`)
  lines.push(`Ngôn ngữ: ${brief.language}`)
  if (brief.keyMessages) lines.push(`Thông điệp chính:\n${brief.keyMessages}`)
  if (brief.cta) lines.push(`CTA mong muốn: ${brief.cta}`)
  if (brief.referenceContent) lines.push(`Nội dung tham khảo:\n${brief.referenceContent}`)
  if (brief.additionalContext) lines.push(`Bối cảnh thêm:\n${brief.additionalContext}`)
  return `--- CONTENT BRIEF ---\n${lines.join('\n')}`
}

// Chỉ lấy N tin nhắn gần nhất làm ngữ cảnh hội thoại — đủ để mạch lạc mà
// không gửi nguyên lịch sử dài vô hạn (yêu cầu 12).
const MAX_RECENT_MESSAGES = 8

export function buildConversationContextMessages(recentMessages: ChatMessage[]): ChatCompletionMessage[] {
  return recentMessages
    .slice(-MAX_RECENT_MESSAGES)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
}

function systemMessage(parts: string[]): ChatCompletionMessage {
  return { role: 'system', content: parts.filter(Boolean).join('\n\n') }
}

// GreenNode (và nhiều API tương thích OpenAI khác) từ chối request chỉ toàn
// role "system" mà không có role "user" nào (HTTP 400) — mọi prompt tác vụ 1
// lượt (generate/transform/quality-check) đều PHẢI kết thúc bằng 1 tin nhắn
// "user" thật sự, dù nội dung chỉ là xác nhận thực hiện yêu cầu ở trên.
function userMessage(content: string): ChatCompletionMessage {
  return { role: 'user', content }
}

// ------------------------------- Feature #3 --------------------------------
export function buildGenerationMessages(input: {
  brand: BrandProfile
  brief: ContentBrief
  channels: ChannelId[]
  recentMessages?: ChatMessage[]
}): ChatCompletionMessage[] {
  const channelList = input.channels.map((c) => `${c} (${labelOf(CHANNELS, c)})`).join(', ')
  const instructions = `${BASE_SYSTEM_INSTRUCTIONS}

Nhiệm vụ: viết nội dung cho ${input.channels.length > 1 ? 'các kênh sau, mỗi kênh 1 bản riêng phù hợp với đặc thù kênh đó' : 'kênh sau'}: ${channelList}.
Mỗi kênh áp dụng đúng brand context ở phần "Riêng cho kênh" nếu có, và định dạng phù hợp kênh (ví dụ LinkedIn có thể dùng đoạn dài hơn + hashtag, Facebook ngắn gọn hơn, Internal đi thẳng vào việc, Email có tiêu đề rõ + mở-thân-CTA).

CHỈ trả lời bằng JSON đúng cấu trúc sau, không thêm chữ nào khác:
{"outputs": [{"channel": "<đúng 1 trong các id kênh trên>", "title": "<tiêu đề ngắn hoặc rỗng nếu không cần>", "content": "<nội dung đầy đủ>"}]}`

  const brandBlocks = input.channels
    .map((channel) => buildBrandContextText(input.brand, channel))
    .filter((text, index, arr) => text && arr.indexOf(text) === index)
  const brief = buildBriefContextText(input.brief)

  return [
    systemMessage([instructions, ...brandBlocks, brief]),
    ...buildConversationContextMessages(input.recentMessages ?? []),
    userMessage('Hãy viết nội dung theo đúng brief và brand context ở trên.'),
  ]
}

// ------------------------------- Feature #4 --------------------------------
const TRANSFORM_INSTRUCTIONS: Record<TransformActionId, string> = {
  rewrite: 'Viết lại toàn bộ nội dung theo hướng khác nhưng giữ nguyên thông điệp và sự thật.',
  shorten: 'Rút ngắn nội dung, giữ lại đúng ý chính quan trọng nhất, bỏ chi tiết phụ.',
  improve_hook: 'CHỈ cải thiện câu/đoạn mở đầu (hook) sao cho thu hút hơn, phần còn lại giữ nguyên nếu vẫn hợp lý.',
  more_human: 'Viết lại để nghe tự nhiên, gần gũi như người thật viết, giảm cảm giác máy móc/AI.',
  more_professional: 'Viết lại theo hướng chuyên nghiệp, trang trọng hơn.',
  translate: 'Dịch toàn bộ nội dung sang ngôn ngữ được chỉ định, giữ nguyên bố cục và ý nghĩa.',
  alternatives: 'Tạo ra NHIỀU phiên bản khác biệt thật sự (khác hook, cấu trúc, hoặc góc kể chuyện) — không chỉ đổi vài từ.',
}

export function buildTransformMessages(input: {
  action: TransformActionId
  brand: BrandProfile
  brief?: ContentBrief
  variant: ContentVariant
  targetLanguage?: string
}): ChatCompletionMessage[] {
  const actionLabel = labelOf(TRANSFORM_ACTIONS, input.action)
  const extra = input.action === 'translate' && input.targetLanguage ? ` Ngôn ngữ đích: ${input.targetLanguage}.` : ''
  const outputShape =
    input.action === 'alternatives'
      ? `{"alternatives": ["<phiên bản 1>", "<phiên bản 2>", "<phiên bản 3>"]}`
      : `{"title": "<tiêu đề mới hoặc giữ nguyên>", "content": "<nội dung sau khi ${actionLabel.toLowerCase()}>"}`

  const instructions = `${BASE_SYSTEM_INSTRUCTIONS}

Nhiệm vụ: ${TRANSFORM_INSTRUCTIONS[input.action]}${extra}
Giữ nguyên thông tin thực tế, thông điệp chính, đối tượng đọc và kênh (${labelOf(CHANNELS, input.variant.channel)}) của nội dung gốc — chỉ thay đổi đúng phần được yêu cầu.

CHỈ trả lời bằng JSON đúng cấu trúc sau, không thêm chữ nào khác:
${outputShape}`

  const brandText = buildBrandContextText(input.brand, input.variant.channel)
  const briefText = input.brief ? buildBriefContextText(input.brief) : ''
  const currentContent = `--- NỘI DUNG HIỆN TẠI (kênh ${input.variant.channel}) ---\nTiêu đề: ${input.variant.title || '(không có)'}\n${input.variant.content}`

  return [
    systemMessage([instructions, brandText, briefText, currentContent]),
    userMessage(`Hãy thực hiện: ${actionLabel}.`),
  ]
}

// ------------------------------- Feature #5 --------------------------------
export function buildQualityCheckMessages(input: {
  brand: BrandProfile
  brief?: ContentBrief
  variant: ContentVariant
}): ChatCompletionMessage[] {
  const instructions = `${BASE_SYSTEM_INSTRUCTIONS}

Nhiệm vụ: đánh giá chất lượng nội dung dưới đây theo đúng các tiêu chí: brand_voice, audience_fit, key_message, grammar, length, repetition, cta, clarity.
Với mỗi tiêu chí, cho status là "pass", "warning" hoặc "fail" kèm 1 câu feedback ngắn gọn bằng tiếng Việt. KHÔNG cho điểm số — chỉ dùng status + feedback.
overallStatus là "pass" nếu không có tiêu chí nào "fail" và không quá 1 tiêu chí "warning", ngược lại là "needs_improvement".
suggestions là danh sách gợi ý cải thiện cụ thể (có thể rỗng nếu mọi thứ đều tốt).
autoFixAvailable là true nếu có ít nhất 1 vấn đề có thể tự sửa được bằng AI.

CHỈ trả lời bằng JSON đúng cấu trúc sau, không thêm chữ nào khác:
{"overallStatus": "pass" | "needs_improvement", "checks": [{"criterion": "<id tiêu chí>", "status": "pass" | "warning" | "fail", "feedback": "..."}], "suggestions": ["..."], "autoFixAvailable": true | false}`

  const brandText = buildBrandContextText(input.brand, input.variant.channel)
  const briefText = input.brief ? buildBriefContextText(input.brief) : ''
  const currentContent = `--- NỘI DUNG CẦN KIỂM TRA (kênh ${input.variant.channel}) ---\nTiêu đề: ${input.variant.title || '(không có)'}\n${input.variant.content}`

  return [
    systemMessage([instructions, brandText, briefText, currentContent]),
    userMessage('Hãy đánh giá nội dung theo đúng hướng dẫn ở trên.'),
  ]
}

export function buildAutoFixMessages(input: {
  brand: BrandProfile
  brief?: ContentBrief
  variant: ContentVariant
  failingFeedback: string[]
}): ChatCompletionMessage[] {
  const instructions = `${BASE_SYSTEM_INSTRUCTIONS}

Nhiệm vụ: sửa nội dung dưới đây để khắc phục CHÍNH XÁC các vấn đề sau, không viết lại những phần không liên quan:
- ${input.failingFeedback.join('\n- ')}

Giữ nguyên thông tin thực tế, thông điệp chính, đối tượng đọc, kênh và giọng thương hiệu.

CHỈ trả lời bằng JSON đúng cấu trúc sau, không thêm chữ nào khác:
{"title": "<tiêu đề>", "content": "<nội dung đã sửa>"}`

  const brandText = buildBrandContextText(input.brand, input.variant.channel)
  const briefText = input.brief ? buildBriefContextText(input.brief) : ''
  const currentContent = `--- NỘI DUNG HIỆN TẠI (kênh ${input.variant.channel}) ---\nTiêu đề: ${input.variant.title || '(không có)'}\n${input.variant.content}`

  return [
    systemMessage([instructions, brandText, briefText, currentContent]),
    userMessage('Hãy sửa nội dung theo đúng hướng dẫn ở trên.'),
  ]
}
