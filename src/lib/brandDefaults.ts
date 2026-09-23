import type { BrandProfile } from '@/types'

// Dữ liệu khởi tạo (seed) cho brand_profile khi CSDL chưa có gì — CHỈ là dữ
// liệu mặc định, không phải luật cứng trong code. Người dùng sửa qua trang
// /brand thì bảng brand_profile đổi, các lần sinh nội dung sau đó tự động
// theo bản mới mà không cần sửa file này hay redeploy.
export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  brandName: 'VNGGames',
  brandDescription: 'Công ty phát hành và phát triển game, hướng tới trải nghiệm giải trí chất lượng cho cộng đồng game thủ.',
  voice: 'Chuyên nghiệp nhưng gần gũi, tự nhiên như người thật viết — không sáo rỗng, không rập khuôn kiểu AI.',
  tones: ['professional', 'human'],
  writingRules: [
    'Dùng câu chủ động, tránh câu bị động dài dòng',
    'Đoạn văn ngắn gọn, mỗi đoạn 1 ý chính',
    'Tránh lặp từ/lặp ý trong cùng một bài',
    'Tránh các cụm từ sáo rỗng kiểu AI (ví dụ: "trong thế giới ngày nay", "không thể phủ nhận rằng")',
    'Hạn chế dùng tiếng lóng quá đà',
  ],
  preferredTerms: [{ preferred: 'Our Grand Upgrade', avoid: 'Our Bold Move' }],
  avoidedTerms: [],
  ctaGuidance: 'CTA ngắn gọn, rõ hành động tiếp theo (ví dụ: "Tìm hiểu thêm", "Đăng ký ngay") — tránh CTA mơ hồ.',
  hashtagGuidance: 'Tối đa 3-5 hashtag liên quan trực tiếp, ưu tiên #VNGGames và tên chiến dịch/sự kiện.',
  channelGuidance: {
    linkedin: 'Chuyên nghiệp, gần gũi, kể chuyện (storytelling), độ dài vừa phải, có thể dùng emoji tiết chế.',
    facebook: 'Giọng ấm áp, trò chuyện hơn, câu ngắn, dễ đọc trên di động.',
    internal: 'Ngắn gọn, rõ ràng, đi thẳng vào hành động cần làm.',
    email: 'Có cấu trúc rõ ràng (mở đầu - nội dung - CTA), giọng chuyên nghiệp.',
  },
}
