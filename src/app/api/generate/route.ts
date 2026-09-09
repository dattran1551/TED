import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getGlossary } from '@/lib/glossary'
import { createRun, saveOutputResult, getRun } from '@/lib/runs'
import { validateInput } from '@/lib/validation'
import { buildPrompt } from '@/lib/promptBuilder'
import { callQwen } from '@/lib/qwenClient'
import type { Branch, GenerateOptions } from '@/types'

// Wraps saveOutputResult so a DB-write failure for one output can never
// reject the outer Promise.all and take down the sibling branches.
function safeSaveOutputResult(
  db: ReturnType<typeof getDb>,
  outputId: number,
  result: Parameters<typeof saveOutputResult>[2]
) {
  try {
    saveOutputResult(db, outputId, result)
  } catch (writeErr) {
    console.error(`Failed to save output ${outputId}:`, writeErr)
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const inputText: string = body.inputText ?? ''
  const options: GenerateOptions = body.options ?? { tones: [], translate: false }

  const validation = validateInput(inputText, options)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  const db = getDb()
  const branches: Branch[] = [...options.tones]
  if (options.translate) branches.push('viet_anh')

  const run = createRun(db, inputText, options, branches)
  const glossary = getGlossary(db)

  await Promise.all(
    run.outputs.map(async (output) => {
      const rule = glossary.find((g) => g.branch === output.branch)
      if (!rule) {
        safeSaveOutputResult(db, output.id, { status: 'error', errorMessage: 'Thiếu bảng thuật ngữ cho nhánh này' })
        return
      }
      try {
        const content = await callQwen(buildPrompt(inputText, output.branch, rule))
        saveOutputResult(db, output.id, { status: 'success', content })
      } catch (err) {
        safeSaveOutputResult(db, output.id, { status: 'error', errorMessage: (err as Error).message })
      }
    })
  )

  const finalRun = getRun(db, run.id)
  return NextResponse.json(finalRun)
}
