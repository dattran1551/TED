import { describe, it, expect } from 'vitest'
import { createDb } from './db'

describe('createDb', () => {
  it('tạo đủ 2 bảng runs và run_outputs', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['runs', 'run_outputs']))
    db.close()
  })

  it('run_outputs có cột source_output_id', () => {
    const db = createDb(':memory:')
    const columns = db.prepare('PRAGMA table_info(run_outputs)').all() as { name: string }[]
    expect(columns.some((c) => c.name === 'source_output_id')).toBe(true)
    db.close()
  })

  it('tạo thêm 2 bảng chat_conversations và chat_messages', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['chat_conversations', 'chat_messages']))
    db.close()
  })

  it('chat_messages có đủ cột conversation_id, role, content, created_at', () => {
    const db = createDb(':memory:')
    const columns = db.prepare('PRAGMA table_info(chat_messages)').all() as { name: string }[]
    const names = columns.map((c) => c.name)
    expect(names).toEqual(expect.arrayContaining(['conversation_id', 'role', 'content', 'created_at']))
    db.close()
  })

  it('mở lại 1 file CSDL giữa các lần chạy vẫn giữ nguyên dữ liệu đã có', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(os.tmpdir(), `ted-test-persist-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    const db1 = createDb(tmpPath)
    db1.prepare("INSERT INTO runs (input_text, options_json) VALUES ('nội dung mẫu', '{}')").run()
    db1.close()

    const db2 = createDb(tmpPath)
    const row = db2.prepare('SELECT input_text FROM runs').get() as any
    expect(row.input_text).toBe('nội dung mẫu')

    db2.close()
    fs.unlinkSync(tmpPath)
  })

  it('mở lại 1 file CSDL cũ (còn bảng glossary_rules từ trước khi bỏ tính năng) vẫn mở được bình thường', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const RawDatabase = require('better-sqlite3')
    const tmpPath = path.join(
      os.tmpdir(),
      `ted-test-oldschema-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    )

    const oldDb = new RawDatabase(tmpPath)
    oldDb.exec(`
      CREATE TABLE glossary_rules (branch TEXT PRIMARY KEY, xung_ho TEXT, tu_vung_uu_tien TEXT, tu_tranh TEXT, nhip_cau TEXT, emoji TEXT);
      INSERT INTO glossary_rules (branch, xung_ho, tu_vung_uu_tien, tu_tranh, nhip_cau, emoji) VALUES ('hai', 'x', 'y', 'z', 'w', 'v');
    `)
    oldDb.close()

    const db = createDb(tmpPath)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['runs', 'run_outputs']))
    // Bảng cũ vẫn còn nguyên đó (không xoá, không đụng tới) — chỉ là app
    // không còn dùng tới nó nữa.
    expect(tables).toContain('glossary_rules')

    db.close()
    fs.unlinkSync(tmpPath)
  })
})
