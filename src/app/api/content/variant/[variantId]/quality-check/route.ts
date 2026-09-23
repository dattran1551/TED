import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPackage, updateVariant } from '@/lib/generatedContent'
import { getLatestQualityCheck, saveQualityCheck } from '@/lib/qualityChecks'
import { loadVariantContext } from '@/lib/variantContext'
import { buildAutoFixMessages, buildQualityCheckMessages } from '@/lib/promptBuilder'
import { generateStructured, StructuredOutputError } from '@/lib/ai'
import { isQualityCheckResult, isSingleContentResponse } from '@/lib/generationSchema'
import { QwenCallError } from '@/lib/qwenClient'
import { QUALITY_CRITERIA, labelOf } from '@/lib/config'
import type { QualityCheckResult } from '@/types'

function aiErrorResponse(err: unknown) {
  if (err instanceof QwenCallError) {
    return NextResponse.json({ error: 'ai_error', message: err.message }, { status: 502 })
  }
  if (err instanceof StructuredOutputError) {
    return NextResponse.json(
      { error: 'ai_bad_response', message: 'TED không kiểm tra được nội dung này, thử lại nhé.' },
      { status: 502 }
    )
  }
  throw err
}

// action: "run" chấm điểm hiện trạng, "fix" áp dụng sửa cho các tiêu chí
// chưa đạt (7.1/7.4) — cả hai dùng chung 1 route vì cùng thao tác trên 1
// biến thể và chia sẻ context (variant/brief/brand).
export async function POST(request: Request, { params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params
  const id = Number(variantId)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (body.action !== 'run' && body.action !== 'fix') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }

  const db = getDb()
  const ctx = loadVariantContext(db, id)
  if (!ctx) {
    return NextResponse.json({ error: 'variant_not_found' }, { status: 404 })
  }

  async function runCheck(): Promise<QualityCheckResult> {
    const messages = buildQualityCheckMessages({ brand: ctx!.brand, brief: ctx!.brief, variant: ctx!.variant })
    const result = await generateStructured(messages, isQualityCheckResult, { timeoutMs: 150_000 })
    saveQualityCheck(db, id, result)
    return result
  }

  if (body.action === 'run') {
    try {
      const qualityCheck = await runCheck()
      return NextResponse.json({ qualityCheck })
    } catch (err) {
      return aiErrorResponse(err)
    }
  }

  // action === 'fix'
  let check = getLatestQualityCheck(db, id)
  try {
    if (!check) check = await runCheck()
  } catch (err) {
    return aiErrorResponse(err)
  }

  const failing = check.checks.filter((c) => c.status !== 'pass')
  if (failing.length === 0) {
    const pkg = getPackage(db, ctx.pkg.id)!
    return NextResponse.json({ package: pkg, qualityCheck: check })
  }

  const failingFeedback = failing.map((c) => `${labelOf(QUALITY_CRITERIA, c.criterion)}: ${c.feedback}`)
  const messages = buildAutoFixMessages({ brand: ctx.brand, brief: ctx.brief, variant: ctx.variant, failingFeedback })

  try {
    const result = await generateStructured(messages, isSingleContentResponse, { timeoutMs: 150_000 })
    updateVariant(db, id, { title: result.title ?? ctx.variant.title, content: result.content, status: 'edited' })
  } catch (err) {
    return aiErrorResponse(err)
  }

  const pkg = getPackage(db, ctx.pkg.id)!
  return NextResponse.json({ package: pkg })
}
