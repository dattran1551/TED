export type Tone = 'chuyen_nghiep' | 're_trung' | 'hai'
export type Branch = Tone | 'viet_anh'

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
