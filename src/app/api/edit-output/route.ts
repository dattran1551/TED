import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { saveEditedContent } from '@/lib/runs'

export async function POST(request: Request) {
  const body = await request.json()
  const outputId: number = body.outputId
  const editedContent: string = body.editedContent ?? ''

  const db = getDb()
  saveEditedContent(db, outputId, editedContent)
  return NextResponse.json({ ok: true })
}
