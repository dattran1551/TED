// Danh sách cấu hình dùng chung cho Structured Brief, Multi-platform Generation,
// Quick Actions và Quality Check. Để ở đây (thay vì rải rác trong logic nghiệp
// vụ) để sau này thêm/bớt lựa chọn chỉ cần sửa 1 chỗ, không phải sửa code xử lý.

export const CONTENT_TYPES = [
  { id: 'social_post', label: 'Social Post' },
  { id: 'linkedin_post', label: 'LinkedIn Post' },
  { id: 'facebook_post', label: 'Facebook Post' },
  { id: 'internal_comm', label: 'Thông báo nội bộ' },
  { id: 'email', label: 'Email' },
  { id: 'recruitment', label: 'Tin tuyển dụng' },
  { id: 'event_recap', label: 'Event Recap' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'headline', label: 'Headline' },
  { id: 'caption', label: 'Caption' },
  { id: 'custom', label: 'Khác' },
] as const

export const CHANNELS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'internal', label: 'Internal' },
  { id: 'email', label: 'Email' },
  { id: 'other', label: 'Khác' },
] as const

export const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'human', label: 'Human' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'warm', label: 'Warm' },
  { id: 'storytelling', label: 'Storytelling' },
  { id: 'concise', label: 'Concise' },
  { id: 'confident', label: 'Confident' },
  { id: 'playful', label: 'Playful' },
] as const

export const LENGTHS = [
  { id: 'short', label: 'Ngắn' },
  { id: 'medium', label: 'Vừa' },
  { id: 'long', label: 'Dài' },
] as const

export const TRANSFORM_ACTIONS = [
  { id: 'rewrite', label: 'Viết lại' },
  { id: 'shorten', label: 'Rút ngắn' },
  { id: 'improve_hook', label: 'Cải thiện câu mở đầu' },
  { id: 'more_human', label: 'Tự nhiên hơn' },
  { id: 'more_professional', label: 'Chuyên nghiệp hơn' },
  { id: 'translate', label: 'Dịch' },
  { id: 'alternatives', label: 'Tạo phiên bản khác' },
] as const

export const QUALITY_CRITERIA = [
  { id: 'brand_voice', label: 'Giọng thương hiệu' },
  { id: 'audience_fit', label: 'Phù hợp đối tượng' },
  { id: 'key_message', label: 'Thông điệp chính' },
  { id: 'grammar', label: 'Ngữ pháp' },
  { id: 'length', label: 'Độ dài' },
  { id: 'repetition', label: 'Lặp ý' },
  { id: 'cta', label: 'Kêu gọi hành động (CTA)' },
  { id: 'clarity', label: 'Rõ ràng' },
] as const

export type ContentTypeId = (typeof CONTENT_TYPES)[number]['id']
export type ChannelId = (typeof CHANNELS)[number]['id']
export type ToneId = (typeof TONES)[number]['id']
export type LengthId = (typeof LENGTHS)[number]['id']
export type TransformActionId = (typeof TRANSFORM_ACTIONS)[number]['id']
export type QualityCriterionId = (typeof QUALITY_CRITERIA)[number]['id']

function idsOf<T extends { id: string }>(list: readonly T[]): string[] {
  return list.map((item) => item.id)
}

export function isContentTypeId(value: unknown): value is ContentTypeId {
  return typeof value === 'string' && idsOf(CONTENT_TYPES).includes(value)
}

export function isChannelId(value: unknown): value is ChannelId {
  return typeof value === 'string' && idsOf(CHANNELS).includes(value)
}

export function isToneId(value: unknown): value is ToneId {
  return typeof value === 'string' && idsOf(TONES).includes(value)
}

export function isLengthId(value: unknown): value is LengthId {
  return typeof value === 'string' && idsOf(LENGTHS).includes(value)
}

export function isTransformActionId(value: unknown): value is TransformActionId {
  return typeof value === 'string' && idsOf(TRANSFORM_ACTIONS).includes(value)
}

export function labelOf<T extends { id: string; label: string }>(list: readonly T[], id: string): string {
  return list.find((item) => item.id === id)?.label ?? id
}
