import type Database from 'better-sqlite3'
import type { Branch, GenerateOptions, Run, RunOutput } from '@/types'

function rowToOutput(row: any): RunOutput {
  return {
    id: row.id,
    runId: row.run_id,
    branch: row.branch,
    content: row.content,
    status: row.status,
    errorMessage: row.error_message,
    editedContent: row.edited_content,
    regenerateNote: row.regenerate_note,
  }
}

export function createRun(
  db: Database.Database,
  inputText: string,
  options: GenerateOptions,
  branches: Branch[]
): Run {
  const info = db
    .prepare('INSERT INTO runs (input_text, options_json) VALUES (?, ?)')
    .run(inputText, JSON.stringify(options))
  const runId = info.lastInsertRowid as number

  const insertOutput = db.prepare('INSERT INTO run_outputs (run_id, branch, status) VALUES (?, ?, ?)')
  const outputs: RunOutput[] = branches.map((branch) => {
    const outInfo = insertOutput.run(runId, branch, 'pending')
    return {
      id: outInfo.lastInsertRowid as number,
      runId,
      branch,
      content: null,
      status: 'pending',
      errorMessage: null,
      editedContent: null,
      regenerateNote: null,
    }
  })

  const row = db.prepare('SELECT created_at FROM runs WHERE id = ?').get(runId) as { created_at: string }
  return { id: runId, inputText, options, createdAt: row.created_at, outputs }
}

export function saveOutputResult(
  db: Database.Database,
  outputId: number,
  result: { status: 'success' | 'error'; content?: string; errorMessage?: string }
): void {
  // edited_content bị xoá về NULL: một kết quả sinh mới luôn thay thế bản sửa
  // tay trước đó. Lần sinh đầu tiên thì cột này vốn đã NULL (không đổi gì);
  // còn khi người dùng bấm "Ghi chú, tạo lại" thì đây chính là cái ngăn màn
  // hình tiếp tục hiện bản sửa cũ đè lên nội dung vừa sinh.
  db.prepare(
    'UPDATE run_outputs SET status = ?, content = ?, error_message = ?, edited_content = NULL WHERE id = ?'
  ).run(result.status, result.content ?? null, result.errorMessage ?? null, outputId)
}

export function saveEditedContent(db: Database.Database, outputId: number, editedContent: string): void {
  db.prepare('UPDATE run_outputs SET edited_content = ? WHERE id = ?').run(editedContent, outputId)
}

export function saveRegenerateNote(db: Database.Database, outputId: number, note: string): void {
  db.prepare('UPDATE run_outputs SET regenerate_note = ? WHERE id = ?').run(note, outputId)
}

export function getRun(db: Database.Database, runId: number): Run | undefined {
  const runRow = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any
  if (!runRow) return undefined
  const outputRows = db.prepare('SELECT * FROM run_outputs WHERE run_id = ? ORDER BY id').all(runId) as any[]
  return {
    id: runRow.id,
    inputText: runRow.input_text,
    options: JSON.parse(runRow.options_json),
    createdAt: runRow.created_at,
    outputs: outputRows.map(rowToOutput),
  }
}

export function listRuns(db: Database.Database, limit = 50): Run[] {
  const runRows = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit) as any[]
  return runRows.map((runRow) => {
    const outputRows = db.prepare('SELECT * FROM run_outputs WHERE run_id = ? ORDER BY id').all(runRow.id) as any[]
    return {
      id: runRow.id,
      inputText: runRow.input_text,
      options: JSON.parse(runRow.options_json),
      createdAt: runRow.created_at,
      outputs: outputRows.map(rowToOutput),
    }
  })
}
