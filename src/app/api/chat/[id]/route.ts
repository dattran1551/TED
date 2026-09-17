import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getConversation, deleteConversation } from '@/lib/chat'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conversationId = Number(id)
  const db = getDb()
  const conversation = getConversation(db, conversationId)
  if (!conversation) {
    return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
  }
  return NextResponse.json(conversation)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conversationId = Number(id)
  const db = getDb()
  const conversation = getConversation(db, conversationId)
  if (!conversation) {
    return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
  }
  deleteConversation(db, conversationId)
  return NextResponse.json({ success: true })
}
