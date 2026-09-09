import { describe, it, expect } from 'vitest'
import { createDb, DEFAULT_GLOSSARY } from './db'

describe('createDb', () => {
  it('tạo đủ 3 bảng và seed sẵn bảng thuật ngữ mặc định', () => {
    const db = createDb(':memory:')

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['glossary_rules', 'runs', 'run_outputs']))

    const rows = db.prepare('SELECT * FROM glossary_rules').all()
    expect(rows).toHaveLength(DEFAULT_GLOSSARY.length)

    db.close()
  })

  it('không seed lại nếu bảng thuật ngữ đã có dữ liệu (mở lại cùng 1 file)', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(os.tmpdir(), `ted-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    const db1 = createDb(tmpPath)
    db1.prepare("UPDATE glossary_rules SET xung_ho = 'đã sửa' WHERE branch = 'hai'").run()
    db1.close()

    // Giả lập mở lại app: gọi createDb lần nữa trên CÙNG 1 file.
    const db2 = createDb(tmpPath)
    const row = db2.prepare("SELECT xung_ho FROM glossary_rules WHERE branch = 'hai'").get() as any
    expect(row.xung_ho).toBe('đã sửa') // nếu seed chạy lại, giá trị này sẽ bị ghi đè về mặc định

    db2.close()
    fs.unlinkSync(tmpPath)
  })
})
