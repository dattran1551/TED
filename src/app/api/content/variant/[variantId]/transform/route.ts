import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPackage, updateVariant } from '@/lib/generatedContent'
import { loadVariantContext } from '@/lib/variantContext'
import { buildTransformMessages } from '@/lib/promptBuilder'
import { generateStructured, StructuredOutputError } from '@/lib/ai'
import { isAlternativesResponse, isSingleContentResponse } from '@/lib/generationSchema'
import { QwenCallError } from '@/lib/qwenClient'
import { isTransformActionId } from '@/lib/config'

// Kiến trúc command-driven (6.3): 1 route xử lý mọi Quick Action, KHÔNG có
// logic prompt riêng cho từng nút bấm — toàn bộ nằm trong buildTransformMessages.
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

  if (!isTransformActionId(body.action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }
  const action = body.action
  const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage.slice(0, 100) : undefined

  const db = getDb()
  const ctx = loadVariantContext(db, id)
  if (!ctx) {
    return NextResponse.json({ error: 'variant_not_found' }, { status: 404 })
  }

  const messages = buildTransformMessages({ action, brand: ctx.brand, brief: ctx.brief, variant: ctx.variant, targetLanguage })

  try {
    if (action === 'alternatives') {
      // Sinh nhiều phiên bản cùng lúc — nặng hơn 1 bản đơn, cần thêm thời gian.
      const result = await generateStructured(messages, isAlternativesResponse, { timeoutMs: 150_000 })
      return NextResponse.json({ alternatives: result.alternatives })
    }

    const result = await generateStructured(messages, isSingleContentResponse, { timeoutMs: 150_000 })
    updateVariant(db, id, { title: result.title ?? ctx.variant.title, content: result.content, status: 'edited' })
    const pkg = getPackage(db, ctx.pkg.id)!
    return NextResponse.json({ package: pkg })
  } catch (err) {
    if (err instanceof QwenCallError) {
      return NextResponse.json({ error: 'ai_error', message: err.message }, { status: 502 })
    }
    if (err instanceof StructuredOutputError) {
      return NextResponse.json(
        { error: 'ai_bad_response', message: 'TED không xử lý được yêu cầu này, thử lại nhé.' },
        { status: 502 }
      )
    }
    throw err
  }
}
