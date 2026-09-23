import type Database from 'better-sqlite3'
import type { QualityCheckResult } from '@/types'

export function saveQualityCheck(db: Database.Database, variantId: number, result: QualityCheckResult): void {
  db.prepare('INSERT INTO quality_checks (variant_id, result) VALUES (?, ?)').run(
    variantId,
    JSON.stringify(result)
  )
}

export function getLatestQualityCheck(db: Database.Database, variantId: number): QualityCheckResult | undefined {
  const row = db
    .prepare('SELECT result FROM quality_checks WHERE variant_id = ? ORDER BY id DESC LIMIT 1')
    .get(variantId) as { result: string } | undefined
  if (!row) return undefined
  try {
    return JSON.parse(row.result) as QualityCheckResult
  } catch {
    return undefined
  }
}
