import { describe, it, expect } from 'vitest'
import { createDb } from './db'
import { createPackage } from './generatedContent'
import { getLatestQualityCheck, saveQualityCheck } from './qualityChecks'
import type { QualityCheckResult } from '@/types'

function makeResult(overallStatus: QualityCheckResult['overallStatus']): QualityCheckResult {
  return {
    overallStatus,
    checks: [{ criterion: 'cta', status: overallStatus === 'pass' ? 'pass' : 'fail', feedback: 'thiếu CTA' }],
    suggestions: overallStatus === 'pass' ? [] : ['thêm CTA rõ ràng'],
    autoFixAvailable: overallStatus !== 'pass',
  }
}

describe('Quality Check storage', () => {
  it('chưa check lần nào thì trả undefined', () => {
    const db = createDb(':memory:')
    const pkg = createPackage(db, { conversationId: null, briefId: null, mode: 'single', variants: [{ channel: 'email', title: '', content: 'x' }] })
    expect(getLatestQualityCheck(db, pkg.variants[0].id)).toBeUndefined()
    db.close()
  })

  it('lấy đúng kết quả gần nhất khi check nhiều lần', () => {
    const db = createDb(':memory:')
    const pkg = createPackage(db, { conversationId: null, briefId: null, mode: 'single', variants: [{ channel: 'email', title: '', content: 'x' }] })
    const variantId = pkg.variants[0].id
    saveQualityCheck(db, variantId, makeResult('needs_improvement'))
    saveQualityCheck(db, variantId, makeResult('pass'))

    const latest = getLatestQualityCheck(db, variantId)
    expect(latest?.overallStatus).toBe('pass')
    db.close()
  })
})
