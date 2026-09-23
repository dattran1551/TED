import type Database from 'better-sqlite3'
import type { ChannelId } from '@/lib/config'
import type { GeneratedContent, GenerationMode, ContentVariant, VariantStatus } from '@/types'

function rowToVariant(row: any): ContentVariant {
  return {
    id: row.id,
    generatedContentId: row.generated_content_id,
    channel: row.channel,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface NewVariantInput {
  channel: ChannelId
  title: string
  content: string
}

export function createPackage(
  db: Database.Database,
  input: {
    conversationId: number | null
    briefId: number | null
    mode: GenerationMode
    variants: NewVariantInput[]
  }
): GeneratedContent {
  const info = db
    .prepare('INSERT INTO generated_content (conversation_id, brief_id, mode) VALUES (?, ?, ?)')
    .run(input.conversationId, input.briefId, input.mode)
  const generatedContentId = info.lastInsertRowid as number

  const insertVariant = db.prepare(
    'INSERT INTO content_variants (generated_content_id, channel, title, content, status) VALUES (?, ?, ?, ?, ?)'
  )
  for (const variant of input.variants) {
    insertVariant.run(generatedContentId, variant.channel, variant.title, variant.content, 'generated')
  }

  return getPackage(db, generatedContentId)!
}

export function getPackage(db: Database.Database, id: number): GeneratedContent | undefined {
  const row = db.prepare('SELECT * FROM generated_content WHERE id = ?').get(id) as any
  if (!row) return undefined
  const variantRows = db
    .prepare('SELECT * FROM content_variants WHERE generated_content_id = ? ORDER BY id')
    .all(id) as any[]
  return {
    id: row.id,
    conversationId: row.conversation_id,
    briefId: row.brief_id,
    mode: row.mode,
    createdAt: row.created_at,
    variants: variantRows.map(rowToVariant),
  }
}

export function listPackagesByConversation(db: Database.Database, conversationId: number): GeneratedContent[] {
  const rows = db
    .prepare('SELECT id FROM generated_content WHERE conversation_id = ? ORDER BY id')
    .all(conversationId) as { id: number }[]
  return rows.map((row) => getPackage(db, row.id)!).filter(Boolean)
}

export function getVariant(db: Database.Database, variantId: number): ContentVariant | undefined {
  const row = db.prepare('SELECT * FROM content_variants WHERE id = ?').get(variantId) as any
  if (!row) return undefined
  return rowToVariant(row)
}

// Cập nhật ĐÚNG 1 biến thể — các biến thể khác trong cùng gói không bị đụng
// tới, đây là yêu cầu bắt buộc của tính năng regenerate độc lập (5.3).
export function updateVariant(
  db: Database.Database,
  variantId: number,
  patch: { title?: string; content: string; status: VariantStatus }
): ContentVariant | undefined {
  const existing = getVariant(db, variantId)
  if (!existing) return undefined
  db.prepare(
    `UPDATE content_variants SET title = ?, content = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(patch.title ?? existing.title, patch.content, patch.status, variantId)
  return getVariant(db, variantId)
}
