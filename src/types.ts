export type Tone = 'chuyen_nghiep' | 're_trung' | 'hai'
export type TranslateTarget = 'dich_anh' | 'dich_hoa'
export type Branch = Tone | TranslateTarget

// Tên tiếng Việt của từng nhánh — dùng chung cho giao diện lẫn prompt gửi model,
// để không nơi nào phải tự lặp lại bảng nhãn này.
export const BRANCH_LABELS: Record<Branch, string> = {
  chuyen_nghiep: 'Chuyên nghiệp',
  re_trung: 'Trẻ trung',
  hai: 'Hài',
  dich_anh: 'Tiếng Anh',
  dich_hoa: 'Tiếng Hoa',
}

export interface GenerateOptions {
  tones: Tone[]
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
  sourceOutputId: number | null
}

export interface Run {
  id: number
  inputText: string
  options: GenerateOptions
  createdAt: string
  outputs: RunOutput[]
}
