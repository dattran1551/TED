import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { GlossaryRule } from '@/types'

export const DEFAULT_GLOSSARY: GlossaryRule[] = [
  {
    branch: 'chuyen_nghiep',
    xungHo: 'chúng tôi / người chơi',
    tuVungUuTien: 'phát hành, chính thức, chương trình',
    tuTranh: 'tiếng lóng, viết tắt',
    nhipCau: 'câu đầy đủ, 18-22 từ',
    emoji: 'không dùng',
  },
  {
    branch: 're_trung',
    xungHo: 'mình / cả nhà / anh em',
    tuVungUuTien: 'đổ bộ, lẹ tay, xịn, toanh',
    tuTranh: 'từ Hán Việt trang trọng',
    nhipCau: 'câu ngắn, nhiều câu cảm',
    emoji: '1-2 emoji, tự nhiên',
  },
  {
    branch: 'hai',
    xungHo: 'tui / bạn',
    tuVungUuTien: 'ẩn dụ phóng đại, tự trào',
    tuTranh: 'giọng nghiêm trọng quá mức',
    nhipCau: 'chốt câu bằng punchline',
    emoji: 'emoji có chọn lọc',
  },
  {
    branch: 'dich_anh',
    xungHo: 'giữ theo bản gốc',
    tuVungUuTien: 'PvP, skin, buff/nerf',
    tuTranh: 'dịch nghĩa đen thuật ngữ game',
    nhipCau: 'giữ thứ tự thông tin gốc',
    emoji: 'giữ theo bản gốc',
  },
  {
    branch: 'dich_hoa',
    xungHo: 'giữ theo bản gốc',
    tuVungUuTien: 'PvP, skin, buff/nerf',
    tuTranh: 'dịch nghĩa đen thuật ngữ game',
    nhipCau: 'giữ thứ tự thông tin gốc',
    emoji: 'giữ theo bản gốc',
  },
]

function migrateRunOutputsSchema(db: Database.Database) {
  const columns = db.prepare('PRAGMA table_info(run_outputs)').all() as { name: string }[]
  const hasSourceOutputId = columns.some((c) => c.name === 'source_output_id')
  if (!hasSourceOutputId) {
    db.exec('ALTER TABLE run_outputs ADD COLUMN source_output_id INTEGER REFERENCES run_outputs(id)')
  }
}

// Chèn các nhánh còn thiếu (dùng cả lúc tạo mới lẫn lúc mở lại 1 file CSDL cũ
// từ trước khi có dich_anh/dich_hoa), và dọn hàng 'viet_anh' đã lỗi thời.
function backfillGlossaryBranches(db: Database.Database) {
  const existingBranches = new Set(
    (db.prepare('SELECT branch FROM glossary_rules').all() as { branch: string }[]).map((r) => r.branch)
  )
  const insert = db.prepare(`
    INSERT INTO glossary_rules (branch, xung_ho, tu_vung_uu_tien, tu_tranh, nhip_cau, emoji)
    VALUES (@branch, @xungHo, @tuVungUuTien, @tuTranh, @nhipCau, @emoji)
  `)
  for (const rule of DEFAULT_GLOSSARY) {
    if (!existingBranches.has(rule.branch)) insert.run(rule)
  }
  db.prepare("DELETE FROM glossary_rules WHERE branch = 'viet_anh'").run()
}

export function createDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  // SQLite mặc định TẮT kiểm tra khoá ngoại, nên ràng buộc run_outputs.run_id
  // -> runs(id) khai báo ở dưới sẽ không có tác dụng nếu không bật dòng này.
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS glossary_rules (
      branch TEXT PRIMARY KEY,
      xung_ho TEXT NOT NULL DEFAULT '',
      tu_vung_uu_tien TEXT NOT NULL DEFAULT '',
      tu_tranh TEXT NOT NULL DEFAULT '',
      nhip_cau TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT ''
    );

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
  backfillGlossaryBranches(db)
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
