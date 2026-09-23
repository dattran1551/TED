import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPackage, getVariant, updateVariant } from '@/lib/generatedContent'

const MAX_CONTENT_LENGTH = 20_000

// Lưu chỉnh sửa thủ công (Feature #4, 6.2) — không gọi AI, chỉ ghi thẳng nội
// dung người dùng đã tự sửa trong trình soạn thảo.
export async function PATCH(request: Request, { params }: { params: Promise<{ variantId: string }> }) {
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

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return NextResponse.json({ error: 'empty_content' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: 'content_too_long' }, { status: 400 })
  }

  const db = getDb()
  const existing = getVariant(db, id)
  if (!existing) {
    return NextResponse.json({ error: 'variant_not_found' }, { status: 404 })
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : existing.title
  updateVariant(db, id, { title, content, status: 'edited' })
  const pkg = getPackage(db, existing.generatedContentId)!
  return NextResponse.json({ package: pkg })
}
