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
  addOutput,
} from './runs'

let db: Database.Database

beforeEach(() => {
  db = createDb(':memory:')
})

describe('runs', () => {
  it('createRun tạo 1 run và đủ output cho từng nhánh, trạng thái pending', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai', 're_trung'] }, ['hai', 're_trung'])
    expect(run.inputText).toBe('nội dung mẫu')
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o) => o.status === 'pending')).toBe(true)
  })

  it('saveOutputResult cập nhật đúng 1 output, không đụng output khác', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai', 're_trung'] }, ['hai', 're_trung'])
    const [first, second] = run.outputs
    saveOutputResult(db, first.id, { status: 'success', content: 'bản hài' })
    saveOutputResult(db, second.id, { status: 'error', errorMessage: 'lỗi mạng' })

    const updated = getRun(db, run.id)!
    const updatedFirst = updated.outputs.find((o) => o.id === first.id)!
    const updatedSecond = updated.outputs.find((o) => o.id === second.id)!
    expect(updatedFirst).toMatchObject({ status: 'success', content: 'bản hài' })
    expect(updatedSecond).toMatchObject({ status: 'error', errorMessage: 'lỗi mạng' })
  })

  it('saveOutputResult xoá bản sửa tay cũ — kết quả sinh lại thay thế bản đã sửa', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const output = run.outputs[0]
    saveOutputResult(db, output.id, { status: 'success', content: 'bản hài lần 1' })
    saveEditedContent(db, output.id, 'bản sửa tay của người dùng')
    expect(getRun(db, run.id)!.outputs[0].editedContent).toBe('bản sửa tay của người dùng')

    // Người dùng bấm "Ghi chú, tạo lại": nội dung mới phải hiện ra, không bị
    // bản sửa tay cũ che mất.
    saveOutputResult(db, output.id, { status: 'success', content: 'bản hài lần 2' })
    const updated = getRun(db, run.id)!.outputs[0]
    expect(updated.content).toBe('bản hài lần 2')
    expect(updated.editedContent).toBeNull()
  })

  it('saveEditedContent và saveRegenerateNote ghi đúng cột', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const output = run.outputs[0]
    saveEditedContent(db, output.id, 'bản đã sửa tay')
    saveRegenerateNote(db, output.id, 'hài hơn nữa')

    const updated = getRun(db, run.id)!
    expect(updated.outputs[0].editedContent).toBe('bản đã sửa tay')
    expect(updated.outputs[0].regenerateNote).toBe('hài hơn nữa')
  })

  it('listRuns trả về run mới nhất trước', () => {
    createRun(db, 'run 1', { tones: ['hai'] }, ['hai'])
    createRun(db, 'run 2', { tones: ['hai'] }, ['hai'])

    const runs = listRuns(db)
    expect(runs).toHaveLength(2)
    expect(runs[0].inputText).toBe('run 2')
  })

  it('listRuns trả về mảng rỗng khi chưa có lượt nào', () => {
    expect(listRuns(db)).toEqual([])
  })

  it('addOutput thêm 1 nhánh mới vào lượt đã có, kèm sourceOutputId', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(db, source.id, { status: 'success', content: 'bản hài gốc' })

    const newOutput = addOutput(db, run.id, 'dich_anh', source.id)
    expect(newOutput.branch).toBe('dich_anh')
    expect(newOutput.sourceOutputId).toBe(source.id)
    expect(newOutput.status).toBe('pending')

    const updated = getRun(db, run.id)!
    expect(updated.outputs).toHaveLength(2)
    const found = updated.outputs.find((o) => o.id === newOutput.id)!
    expect(found.sourceOutputId).toBe(source.id)
  })
})
