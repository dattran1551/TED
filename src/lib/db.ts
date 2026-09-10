import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

function migrateRunOutputsSchema(db: Database.Database) {
  const columns = db.prepare('PRAGMA table_info(run_outputs)').all() as { name: string }[]
  const hasSourceOutputId = columns.some((c) => c.name === 'source_output_id')
  if (!hasSourceOutputId) {
    db.exec('ALTER TABLE run_outputs ADD COLUMN source_output_id INTEGER REFERENCES run_outputs(id)')
  }
}

export function createDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  // SQLite mặc định TẮT kiểm tra khoá ngoại, nên ràng buộc run_outputs.run_id
  // -> runs(id) khai báo ở dưới sẽ không có tác dụng nếu không bật dòng này.
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS run_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id),
      branch TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      edited_content TEXT,
      regenerate_note TEXT,
      source_output_id INTEGER REFERENCES run_outputs(id)
    );
  `)
  migrateRunOutputsSchema(db)
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
