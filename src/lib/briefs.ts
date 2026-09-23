import type Database from 'better-sqlite3'
import type { ContentBrief } from '@/types'
import { isLengthId, isToneId, isContentTypeId } from '@/lib/config'

const MAX_TEXT_LENGTH = 4000

function cleanOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, MAX_TEXT_LENGTH)
  return trimmed.length > 0 ? trimmed : undefined
}

// Không field nào bắt buộc (đúng yêu cầu 3.6/3.8) — thiếu gì thì lấy mặc định
// hợp lý, để người dùng có thể chỉ gõ tự nhiên mà không cần điền hết form.
export function normalizeBrief(raw: unknown): ContentBrief {
  const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const tones = Array.isArray(input.tones) ? input.tones.filter(isToneId) : []
  return {
    contentType: isContentTypeId(input.contentType) ? input.contentType : 'social_post',
    audience: cleanOptionalText(input.audience),
    objective: cleanOptionalText(input.objective),
    tones,
    length: isLengthId(input.length) ? input.length : 'medium',
    language: cleanOptionalText(input.language) ?? 'vi',
    keyMessages: cleanOptionalText(input.keyMessages),
    cta: cleanOptionalText(input.cta),
    referenceContent: cleanOptionalText(input.referenceContent),
    additionalContext: cleanOptionalText(input.additionalContext),
  }
}

export function createBrief(db: Database.Database, conversationId: number | null, raw: unknown): { id: number; brief: ContentBrief } {
  const brief = normalizeBrief(raw)
  const info = db
    .prepare('INSERT INTO content_briefs (conversation_id, data) VALUES (?, ?)')
    .run(conversationId, JSON.stringify(brief))
  return { id: info.lastInsertRowid as number, brief }
}

export function getBrief(db: Database.Database, id: number): ContentBrief | undefined {
  const row = db.prepare('SELECT data FROM content_briefs WHERE id = ?').get(id) as { data: string } | undefined
  if (!row) return undefined
  try {
    return normalizeBrief(JSON.parse(row.data))
  } catch {
    return undefined
  }
}
