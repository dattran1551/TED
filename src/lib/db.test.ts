import { describe, it, expect } from 'vitest'
import { createDb } from './db'

describe('createDb', () => {
  it('tạo 2 bảng chat_conversations và chat_messages', () => {
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

  it('không còn tạo bảng runs/run_outputs của luồng cũ đã bỏ', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).not.toContain('runs')
    expect(tables).not.toContain('run_outputs')
    db.close()
  })

  it('mở lại 1 file CSDL giữa các lần chạy vẫn giữ nguyên dữ liệu đã có', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(os.tmpdir(), `ted-test-persist-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    const db1 = createDb(tmpPath)
    const info = db1.prepare('INSERT INTO chat_conversations DEFAULT VALUES').run()
    db1.close()

    const db2 = createDb(tmpPath)
    const row = db2.prepare('SELECT id FROM chat_conversations WHERE id = ?').get(info.lastInsertRowid) as any
    expect(row.id).toBe(info.lastInsertRowid)

    db2.close()
    fs.unlinkSync(tmpPath)
  })

  it('tạo đủ các bảng mới cho Brand Brain / Structured Brief / Multi-platform / Quality Check', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(
      expect.arrayContaining([
        'brand_profile',
        'content_briefs',
        'generated_content',
        'content_variants',
        'quality_checks',
      ])
    )
    db.close()
  })

  it('mở 1 file CSDL CŨ (chỉ có 2 bảng chat gốc, chưa có bảng mới) vẫn mở được và tự thêm bảng mới, không mất dữ liệu cũ', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(os.tmpdir(), `ted-test-migrate-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    const db1 = createDb(tmpPath)
    const info = db1.prepare('INSERT INTO chat_conversations DEFAULT VALUES').run()
    db1.prepare('INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
      info.lastInsertRowid,
      'user',
      'tin nhắn cũ trước khi có tính năng mới'
    )
    db1.close()

    const db2 = createDb(tmpPath)
    const conv = db2.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(info.lastInsertRowid) as any
    expect(conv).toBeTruthy()
    const messages = db2.prepare('SELECT * FROM chat_messages WHERE conversation_id = ?').all(info.lastInsertRowid) as any[]
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('tin nhắn cũ trước khi có tính năng mới')

    const brandRow = db2.prepare('SELECT * FROM brand_profile WHERE id = 1').get()
    expect(brandRow).toBeTruthy()

    db2.close()
    fs.unlinkSync(tmpPath)
  })

  it('mở lại 1 file CSDL cũ (còn bảng runs/glossary_rules từ trước khi bỏ luồng cũ) vẫn mở được bình thường', () => {
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
      CREATE TABLE runs (id INTEGER PRIMARY KEY, input_text TEXT);
      CREATE TABLE glossary_rules (branch TEXT PRIMARY KEY);
    `)
    oldDb.close()

    const db = createDb(tmpPath)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['chat_conversations', 'chat_messages']))
    // Bảng cũ vẫn còn nguyên đó (không xoá, không đụng tới) — chỉ là app
    // không còn dùng tới nó nữa.
    expect(tables).toContain('runs')
    expect(tables).toContain('glossary_rules')

    db.close()
    fs.unlinkSync(tmpPath)
  })
})
