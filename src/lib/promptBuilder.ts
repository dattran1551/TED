import { BRANCH_LABELS } from '@/types'
import type { Branch, GlossaryRule } from '@/types'

export function buildPrompt(inputText: string, branch: Branch, rule: GlossaryRule): string {
  if (branch === 'viet_anh') {
    return [
      'Bạn là trợ lý dịch nội dung sang tiếng Anh.',
      `Giữ nguyên, không dịch các thuật ngữ sau: ${rule.tuVungUuTien}.`,
      `Không dịch nghĩa đen các thuật ngữ bị cấm: ${rule.tuTranh}.`,
      `Giữ đúng thứ tự thông tin gốc: ${rule.nhipCau}.`,
      '',
      'Nội dung gốc:',
      inputText,
      '',
      'Hãy dịch sang tiếng Anh, chỉ trả về bản dịch, không thêm giải thích.',
    ].join('\n')
  }

  return [
    `Bạn là trợ lý viết lại nội dung theo giọng văn: ${BRANCH_LABELS[branch]}.`,
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
