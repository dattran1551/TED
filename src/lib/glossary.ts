import type Database from 'better-sqlite3'
import type { Branch, GlossaryRule } from '@/types'

function rowToRule(row: any): GlossaryRule {
  return {
    branch: row.branch,
    xungHo: row.xung_ho,
    tuVungUuTien: row.tu_vung_uu_tien,
    tuTranh: row.tu_tranh,
    nhipCau: row.nhip_cau,
    emoji: row.emoji,
  }
}

export function getGlossary(db: Database.Database): GlossaryRule[] {
  const rows = db.prepare('SELECT * FROM glossary_rules').all()
  return rows.map(rowToRule)
}

export function getGlossaryRule(db: Database.Database, branch: Branch): GlossaryRule | undefined {
  const row = db.prepare('SELECT * FROM glossary_rules WHERE branch = ?').get(branch)
  return row ? rowToRule(row) : undefined
}

export function updateGlossaryRule(db: Database.Database, rule: GlossaryRule): void {
  db.prepare(
    `UPDATE glossary_rules
     SET xung_ho = @xungHo, tu_vung_uu_tien = @tuVungUuTien, tu_tranh = @tuTranh, nhip_cau = @nhipCau, emoji = @emoji
     WHERE branch = @branch`
  ).run(rule)
}
