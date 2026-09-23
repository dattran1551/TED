export interface GenerationOutput {
  channel: string
  title?: string
  content: string
}

export interface GenerationResponse {
  outputs: GenerationOutput[]
}

export function isGenerationResponse(data: unknown): data is GenerationResponse {
  if (typeof data !== 'object' || data === null) return false
  const outputs = (data as Record<string, unknown>).outputs
  if (!Array.isArray(outputs)) return false
  return outputs.every(
    (o) =>
      o &&
      typeof o === 'object' &&
      typeof (o as Record<string, unknown>).channel === 'string' &&
      typeof (o as Record<string, unknown>).content === 'string' &&
      (o as Record<string, unknown>).content !== ''
  )
}

export interface SingleContentResponse {
  title?: string
  content: string
}

export function isSingleContentResponse(data: unknown): data is SingleContentResponse {
  if (typeof data !== 'object' || data === null) return false
  const content = (data as Record<string, unknown>).content
  return typeof content === 'string' && content !== ''
}

import type { QualityCheckResult } from '@/types'

const QUALITY_STATUSES = ['pass', 'warning', 'fail']

export function isQualityCheckResult(data: unknown): data is QualityCheckResult {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (d.overallStatus !== 'pass' && d.overallStatus !== 'needs_improvement') return false
  if (!Array.isArray(d.checks)) return false
  const checksValid = d.checks.every((c) => {
    if (typeof c !== 'object' || c === null) return false
    const item = c as Record<string, unknown>
    return (
      typeof item.criterion === 'string' &&
      typeof item.status === 'string' &&
      QUALITY_STATUSES.includes(item.status) &&
      typeof item.feedback === 'string'
    )
  })
  if (!checksValid) return false
  if (!Array.isArray(d.suggestions) || !d.suggestions.every((s) => typeof s === 'string')) return false
  if (typeof d.autoFixAvailable !== 'boolean') return false
  return true
}

export interface AlternativesResponse {
  alternatives: string[]
}

export function isAlternativesResponse(data: unknown): data is AlternativesResponse {
  if (typeof data !== 'object' || data === null) return false
  const alternatives = (data as Record<string, unknown>).alternatives
  return (
    Array.isArray(alternatives) &&
    alternatives.length > 0 &&
    alternatives.every((a) => typeof a === 'string' && a.trim() !== '')
  )
}
