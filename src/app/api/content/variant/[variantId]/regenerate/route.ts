import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPackage, updateVariant } from '@/lib/generatedContent'
import { loadVariantContext } from '@/lib/variantContext'
import { buildGenerationMessages } from '@/lib/promptBuilder'
import { generateStructured, StructuredOutputError } from '@/lib/ai'
import { isGenerationResponse } from '@/lib/generationSchema'
import { QwenCallError } from '@/lib/qwenClient'

// Regenerate ĐÚNG 1 biến thể — các biến thể khác trong cùng gói không bị đụng
// tới (yêu cầu 5.3). Dùng lại buildGenerationMessages với channels chỉ gồm
// đúng kênh của biến thể này, không lặp lại logic ghép prompt.
export async function POST(request: Request, { params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params
  const id = Number(variantId)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const db = getDb()
  const ctx = loadVariantContext(db, id)
  if (!ctx) {
    return NextResponse.json({ error: 'variant_not_found' }, { status: 404 })
  }

  const messages = buildGenerationMessages({
    brand: ctx.brand,
    brief: ctx.brief,
    channels: [ctx.variant.channel],
  })

  try {
    const result = await generateStructured(messages, isGenerationResponse, { timeoutMs: 150_000 })
    const output = result.outputs.find((o) => o.channel === ctx.variant.channel) ?? result.outputs[0]
    if (!output) throw new StructuredOutputError('AI không trả về nội dung cho kênh này')
    updateVariant(db, id, { title: output.title ?? '', content: output.content, status: 'generated' })
  } catch (err) {
    if (err instanceof QwenCallError) {
      return NextResponse.json({ error: 'ai_error', message: err.message }, { status: 502 })
    }
    if (err instanceof StructuredOutputError) {
      return NextResponse.json(
        { error: 'ai_bad_response', message: 'TED không tạo lại được nội dung, thử lại nhé.' },
        { status: 502 }
      )
    }
    throw err
  }

  const pkg = getPackage(db, ctx.pkg.id)!
  return NextResponse.json({ package: pkg })
}
