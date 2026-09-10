import { BRANCH_LABELS } from '@/types'
import type { Branch, GlossaryRule, TranslateTarget } from '@/types'

const TRANSLATE_TARGET_LANGUAGE: Record<TranslateTarget, string> = {
  dich_anh: 'tiếng Anh',
  dich_hoa: 'tiếng Hoa (chữ Giản thể)',
}

function isTranslateTarget(branch: Branch): branch is TranslateTarget {
  return branch === 'dich_anh' || branch === 'dich_hoa'
}

export function buildPrompt(inputText: string, branch: Branch, rule: GlossaryRule): string {
  if (isTranslateTarget(branch)) {
    const language = TRANSLATE_TARGET_LANGUAGE[branch]
    return [
      `Bạn là trợ lý dịch nội dung sang ${language}.`,
      `Giữ nguyên, không dịch các thuật ngữ sau: ${rule.tuVungUuTien}.`,
      `Không dịch nghĩa đen các thuật ngữ bị cấm: ${rule.tuTranh}.`,
      `Giữ đúng thứ tự thông tin gốc: ${rule.nhipCau}.`,
      'Giữ nguyên bố cục, cách xuống dòng và cấu trúc của bản gốc — chỉ dịch ngôn ngữ, không thay đổi cấu trúc.',
      '',
      'Nội dung gốc:',
      inputText,
      '',
      `Hãy dịch sang ${language}, chỉ trả về bản dịch, không thêm giải thích.`,
    ].join('\n')
  }

  return [
    `Bạn là trợ lý viết lại nội dung theo giọng văn: ${BRANCH_LABELS[branch]}.`,
    'Trước tiên, hãy tự nhận diện người dùng đang muốn tạo ra loại nội dung thực tế gì (ví dụ: bài đăng mạng xã hội, thông báo nội bộ công ty, email, tin nhắn...) dựa vào chính nội dung/yêu cầu bên dưới.',
    'Sau đó viết đúng theo bố cục chuẩn ngoài đời thật của loại nội dung đó (ví dụ: bài đăng mạng xã hội cần câu mở đầu thu hút, xuống dòng tách từng ý, có thể kèm hashtag; thông báo nội bộ cần tiêu đề và bố cục trang trọng, rõ ràng) — không gộp mọi thứ thành một đoạn văn xuôi liền mạch nếu loại nội dung đó không viết như vậy ngoài đời thật.',
    'Áp dụng các quy tắc giọng văn dưới đây NGAY TRONG bố cục đó, không đổi loại nội dung:',
    `Xưng hô: ${rule.xungHo}.`,
    `Ưu tiên dùng các từ/cụm: ${rule.tuVungUuTien}.`,
    `Tránh dùng: ${rule.tuTranh}.`,
    `Nhịp câu: ${rule.nhipCau}.`,
    `Chính sách emoji: ${rule.emoji}.`,
    '',
    'Nội dung gốc:',
    inputText,
    '',
    'Hãy viết lại theo đúng các quy tắc trên. Chỉ trả về bản viết lại, không thêm giải thích.',
  ].join('\n')
}

export function buildRegeneratePrompt(
  inputText: string,
  branch: Branch,
  rule: GlossaryRule,
  note: string
): string {
  return buildPrompt(inputText, branch, rule) + `\n\nGhi chú điều chỉnh thêm từ người dùng: ${note}`
}
