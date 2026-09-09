import type { GenerateOptions } from '@/types'

export const MAX_WORDS = 2000

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).length
}

export interface ValidationResult {
  valid: boolean
  reason?: 'empty' | 'too_long' | 'no_options'
}

export function validateInput(text: string, options: GenerateOptions): ValidationResult {
  const wordCount = countWords(text)
  if (wordCount === 0) return { valid: false, reason: 'empty' }
  if (wordCount > MAX_WORDS) return { valid: false, reason: 'too_long' }
  const hasAnyOption = options.tones.length > 0 || options.translate
  if (!hasAnyOption) return { valid: false, reason: 'no_options' }
  return { valid: true }
}
