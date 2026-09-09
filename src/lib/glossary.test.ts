import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDb } from './db'
import { getGlossary, getGlossaryRule, updateGlossaryRule } from './glossary'

let db: Database.Database

beforeEach(() => {
  db = createDb(':memory:')
})

describe('glossary', () => {
  it('getGlossary trả về 4 dòng mặc định', () => {
    expect(getGlossary(db)).toHaveLength(4)
  })

  it('getGlossaryRule lấy đúng 1 dòng theo branch', () => {
    const rule = getGlossaryRule(db, 'hai')
    expect(rule?.branch).toBe('hai')
    expect(rule?.xungHo).toBe('tui / bạn')
  })

  it('updateGlossaryRule ghi đè đúng dòng, không ảnh hưởng dòng khác', () => {
    updateGlossaryRule(db, {
      branch: 'hai',
      xungHo: 'tao / mày (test)',
      tuVungUuTien: 'x',
      tuTranh: 'y',
      nhipCau: 'z',
      emoji: 'w',
    })
    expect(getGlossaryRule(db, 'hai')?.xungHo).toBe('tao / mày (test)')
    expect(getGlossaryRule(db, 'chuyen_nghiep')?.xungHo).toBe('chúng tôi / người chơi')
  })
})
