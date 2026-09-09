import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDb } from './db'
import {
  createRun,
  saveOutputResult,
  saveEditedContent,
  saveRegenerateNote,
  getRun,
  listRuns,
} from './runs'

let db: Database.Database

beforeEach(() => {
  db = createDb(':memory:')
})

describe('runs', () => {
  it('createRun tạo 1 run và đủ output cho từng nhánh, trạng thái pending', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'], translate: true }, ['hai', 'viet_anh'])
    expect(run.inputText).toBe('nội dung mẫu')
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o) => o.status === 'pending')).toBe(true)
  })

  it('saveOutputResult cập nhật đúng 1 output, không đụng output khác', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'], translate: true }, ['hai', 'viet_anh'])
    const [first, second] = run.outputs
    saveOutputResult(db, first.id, { status: 'success', content: 'bản hài' })
    saveOutputResult(db, second.id, { status: 'error', errorMessage: 'lỗi mạng' })

    const updated = getRun(db, run.id)!
    const updatedFirst = updated.outputs.find((o) => o.id === first.id)!
    const updatedSecond = updated.outputs.find((o) => o.id === second.id)!
    expect(updatedFirst).toMatchObject({ status: 'success', content: 'bản hài' })
    expect(updatedSecond).toMatchObject({ status: 'error', errorMessage: 'lỗi mạng' })
  })

  it('saveEditedContent và saveRegenerateNote ghi đúng cột', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'], translate: false }, ['hai'])
    const output = run.outputs[0]
    saveEditedContent(db, output.id, 'bản đã sửa tay')
    saveRegenerateNote(db, output.id, 'hài hơn nữa')

    const updated = getRun(db, run.id)!
    expect(updated.outputs[0].editedContent).toBe('bản đã sửa tay')
    expect(updated.outputs[0].regenerateNote).toBe('hài hơn nữa')
  })

  it('listRuns trả về run mới nhất trước', () => {
    createRun(db, 'run 1', { tones: ['hai'], translate: false }, ['hai'])
    createRun(db, 'run 2', { tones: ['hai'], translate: false }, ['hai'])

    const runs = listRuns(db)
    expect(runs).toHaveLength(2)
    expect(runs[0].inputText).toBe('run 2')
  })

  it('listRuns trả về mảng rỗng khi chưa có lượt nào', () => {
    expect(listRuns(db)).toEqual([])
  })
})
