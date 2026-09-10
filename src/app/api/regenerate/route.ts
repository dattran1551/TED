import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getGlossary } from '@/lib/glossary'
import { getRun, saveOutputResult, saveRegenerateNote } from '@/lib/runs'
import { buildRegeneratePrompt } from '@/lib/promptBuilder'
import { callQwen } from '@/lib/qwenClient'

export async function POST(request: Request) {
  const body = await request.json()
  const runId: number = body.runId
  const outputId: number = body.outputId
  const note: string = body.note ?? ''

  const db = getDb()
  const run = getRun(db, runId)
  if (!run) {
    return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
  }
  const output = run.outputs.find((o) => o.id === outputId)
  if (!output) {
    return NextResponse.json({ error: 'output_not_found' }, { status: 404 })
  }
  const glossary = getGlossary(db)
  const rule = glossary.find((g) => g.branch === output.branch)
  if (!rule) {
    return NextResponse.json({ error: 'glossary_missing' }, { status: 400 })
  }

  // Với nhánh dịch (có sourceOutputId), phải dịch lại từ ĐÚNG bản giọng văn đã
  // chọn (có thể đã được sửa tay), không phải từ câu nhập gốc của cả lượt.
  let baseText = run.inputText
  if (output.sourceOutputId !== null) {
    const source = run.outputs.find((o) => o.id === output.sourceOutputId)
    baseText = source?.editedContent ?? source?.content ?? run.inputText
  }

  saveRegenerateNote(db, outputId, note)

  try {
    const content = await callQwen(buildRegeneratePrompt(baseText, output.branch, rule, note))
    saveOutputResult(db, outputId, { status: 'success', content })
  } catch (err) {
    saveOutputResult(db, outputId, { status: 'error', errorMessage: (err as Error).message })
  }

  const finalRun = getRun(db, runId)
  return NextResponse.json(finalRun)
}
