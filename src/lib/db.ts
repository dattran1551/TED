import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { DEFAULT_BRAND_PROFILE } from './brandDefaults'

export function createDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  // SQLite mặc định TẮT kiểm tra khoá ngoại, nên ràng buộc chat_messages.conversation_id
  // -> chat_conversations(id) khai báo ở dưới sẽ không có tác dụng nếu không bật dòng này.
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Feature #2 Brand Brain: 1 dòng duy nhất (id luôn = 1), toàn bộ hồ sơ
    -- thương hiệu lưu dạng JSON trong "data" để mở rộng field sau này không
    -- cần migration cột. Sửa qua API /api/brand, không cần sửa code/deploy.
    CREATE TABLE IF NOT EXISTS brand_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Feature #1 Structured Brief.
    CREATE TABLE IF NOT EXISTS content_briefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER REFERENCES chat_conversations(id),
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Feature #3 Multi-platform generation: 1 "gói" gồm nhiều biến thể theo kênh.
    CREATE TABLE IF NOT EXISTS generated_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER REFERENCES chat_conversations(id),
      brief_id INTEGER REFERENCES content_briefs(id),
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generated_content_id INTEGER NOT NULL REFERENCES generated_content(id),
      channel TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Feature #5 Content Quality Check — mỗi lần "TED Check" thêm 1 dòng mới,
    -- giữ lại lịch sử để so sánh trước/sau "Fix with TED" nếu cần.
    CREATE TABLE IF NOT EXISTS quality_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL REFERENCES content_variants(id),
      result TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  db.prepare('INSERT OR IGNORE INTO brand_profile (id, data) VALUES (1, ?)').run(
    JSON.stringify(DEFAULT_BRAND_PROFILE)
  )

  return db
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  const dataDir = process.env.TED_DATA_DIR || path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  _db = createDb(path.join(dataDir, 'ted.db'))
  return _db
}
