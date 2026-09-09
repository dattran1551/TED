export type Tone = 'chuyen_nghiep' | 're_trung' | 'hai'
export type Branch = Tone | 'viet_anh'

// Tên tiếng Việt của từng nhánh — dùng chung cho giao diện lẫn prompt gửi model,
// để không nơi nào phải tự lặp lại bảng nhãn này.
export const BRANCH_LABELS: Record<Branch, string> = {
  chuyen_nghiep: 'Chuyên nghiệp',
  re_trung: 'Trẻ trung',
  hai: 'Hài',
  viet_anh: 'Việt ↔ Anh',
}

export interface GlossaryRule {
  branch: Branch
  xungHo: string
  tuVungUuTien: string
  tuTranh: string
  nhipCau: string
  emoji: string
}

export interface GenerateOptions {
  tones: Tone[]
  translate: boolean
}

export interface RunOutput {
  id: number
  runId: number
  branch: Branch
  content: string | null
  status: 'pending' | 'success' | 'error'
  errorMessage: string | null
  editedContent: string | null
  regenerateNote: string | null
}

export interface Run {
  id: number
  inputText: string
  options: GenerateOptions
  createdAt: string
  outputs: RunOutput[]
}
