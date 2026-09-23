import type { ChannelId, ContentTypeId, LengthId, QualityCriterionId, ToneId } from '@/lib/config'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: number
  conversationId: number
  role: ChatRole
  content: string
  createdAt: string
}

export interface ChatConversation {
  id: number
  createdAt: string
  messages: ChatMessage[]
  // Các gói nội dung (Feature #3) đã tạo trong cuộc chat này — tin nhắn nào
  // đánh dấu bằng content marker (xem contentMarker.ts) sẽ tra vào đây để
  // hiển thị thẻ nội dung thay vì chữ thô.
  contentPackages?: GeneratedContent[]
}

export interface ChatConversationSummary {
  id: number
  createdAt: string
  preview: string
}

// ------------------------------- Feature #1 -------------------------------
// Structured Brief / Smart Composer. Không field nào bắt buộc ngoài
// contentType/length/language (đều có default) — người dùng có thể chỉ gõ
// tự nhiên, TED tự suy luận phần còn thiếu khi viết.
export interface ContentBrief {
  contentType: ContentTypeId
  audience?: string
  objective?: string
  tones: ToneId[]
  length: LengthId
  language: string
  keyMessages?: string
  cta?: string
  referenceContent?: string
  additionalContext?: string
}

// ------------------------------- Feature #2 -------------------------------
// Brand Brain — cấu hình thương hiệu, không hard-code trong logic nghiệp vụ.
// Lưu nguyên object này dưới dạng JSON trong bảng brand_profile.
export interface BrandTermRule {
  preferred: string
  avoid?: string
}

export interface BrandProfile {
  brandName: string
  brandDescription: string
  voice: string
  tones: string[]
  writingRules: string[]
  preferredTerms: BrandTermRule[]
  avoidedTerms: string[]
  ctaGuidance: string
  hashtagGuidance: string
  channelGuidance: Partial<Record<ChannelId, string>>
  updatedAt?: string
}

// ------------------------------- Feature #3 -------------------------------
// Multi-platform generation — 1 brief sinh ra nhiều biến thể theo kênh, mỗi
// biến thể regenerate/edit độc lập.
export type VariantStatus = 'generated' | 'edited' | 'error'

export interface ContentVariant {
  id: number
  generatedContentId: number
  channel: ChannelId
  title: string
  content: string
  status: VariantStatus
  createdAt: string
  updatedAt: string
}

export type GenerationMode = 'single' | 'package'

export interface GeneratedContent {
  id: number
  conversationId: number | null
  briefId: number | null
  mode: GenerationMode
  createdAt: string
  variants: ContentVariant[]
}

// ------------------------------- Feature #5 -------------------------------
// Content Quality Check — kết quả có cấu trúc, không dùng điểm số giả precision.
export type QualityCheckItemStatus = 'pass' | 'warning' | 'fail'
export type QualityOverallStatus = 'pass' | 'needs_improvement'

export interface QualityCheckItem {
  criterion: QualityCriterionId
  status: QualityCheckItemStatus
  feedback: string
}

export interface QualityCheckResult {
  overallStatus: QualityOverallStatus
  checks: QualityCheckItem[]
  suggestions: string[]
  autoFixAvailable: boolean
}
