import type Database from 'better-sqlite3'
import type { ChatConversation, ChatConversationSummary, ChatMessage, ChatRole } from '@/types'

function rowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }
}

export function createConversation(db: Database.Database): number {
  const info = db.prepare('INSERT INTO chat_conversations DEFAULT VALUES').run()
  return info.lastInsertRowid as number
}

export function addMessage(
  db: Database.Database,
  conversationId: number,
  role: ChatRole,
  content: string
): ChatMessage {
  const info = db
    .prepare('INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)')
    .run(conversationId, role, content)
  const row = db
    .prepare('SELECT created_at FROM chat_messages WHERE id = ?')
    .get(info.lastInsertRowid) as { created_at: string }
  return {
    id: info.lastInsertRowid as number,
    conversationId,
    role,
    content,
    createdAt: row.created_at,
  }
}

export function getConversation(db: Database.Database, conversationId: number): ChatConversation | undefined {
  const convRow = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(conversationId) as any
  if (!convRow) return undefined
  const messageRows = db
    .prepare('SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY id')
    .all(conversationId) as any[]
  return {
    id: convRow.id,
    createdAt: convRow.created_at,
    messages: messageRows.map(rowToMessage),
  }
}

export function listConversations(db: Database.Database, limit = 50): ChatConversationSummary[] {
  const convRows = db
    .prepare('SELECT * FROM chat_conversations ORDER BY id DESC LIMIT ?')
    .all(limit) as any[]
  return convRows.map((convRow) => {
    const firstUserMessage = db
      .prepare(
        "SELECT content FROM chat_messages WHERE conversation_id = ? AND role = 'user' ORDER BY id LIMIT 1"
      )
      .get(convRow.id) as { content: string } | undefined
    const preview = firstUserMessage?.content.slice(0, 80) ?? '(chưa có tin nhắn)'
    return {
      id: convRow.id,
      createdAt: convRow.created_at,
      preview,
    }
  })
}
