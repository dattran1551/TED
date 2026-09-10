import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getGlossary } from '@/lib/glossary'
import { getRun, addOutput, saveOutputResult } from '@/lib/runs'
import { buildPrompt } from '@/lib/promptBuilder'
import { callQwen } from '@/lib/qwenClient'
import type { TranslateTarget } from '@/types'

const VALID_TARGETS: TranslateTarget[] = ['dich_anh', 'dich_hoa']

export async function POST(request: Request) {
  const body = await request.json()
  const runId: number = body.runId
  const sourceOutputId: number = body.sourceOutputId
  const targetBranch: TranslateTarget = body.targetBranch

  if (!VALID_TARGETS.includes(targetBranch)) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 })
  }

  const db = getDb()
  const run = getRun(db, runId)
  if (!run) {
    return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
  }
  const source = run.outputs.find((o) => o.id === sourceOutputId)
  if (!source || source.status !== 'success') {
    return NextResponse.json({ error: 'source_not_ready' }, { status: 400 })
  }
  const glossary = getGlossary(db)
  const rule = glossary.find((g) => g.branch === targetBranch)
  if (!rule) {
    return NextResponse.json({ error: 'glossary_missing' }, { status: 400 })
  }

  const sourceText = source.editedContent ?? source.content ?? ''

  // Nếu đã dịch nhánh này từ trước (vd bấm lại), dùng lại đúng bản ghi cũ thay
  // vì tạo thêm 1 thẻ trùng lặp cho cùng ngôn ngữ.
  const existing = run.outputs.find((o) => o.branch === targetBranch && o.sourceOutputId === sourceOutputId)
  const output = existing ?? addOutput(db, runId, targetBranch, sourceOutputId)

  try {
    const content = await callQwen(buildPrompt(sourceText, targetBranch, rule))
    saveOutputResult(db, output.id, { status: 'success', content })
  } catch (err) {
    saveOutputResult(db, output.id, { status: 'error', errorMessage: (err as Error).message })
  }

  const finalRun = getRun(db, runId)
  return NextResponse.json(finalRun)
}
