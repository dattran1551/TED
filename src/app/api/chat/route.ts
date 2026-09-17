import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createConversation, addMessage, getConversation, listConversations } from '@/lib/chat'
import { callQwenMessages } from '@/lib/qwenClient'
import { CHAT_SYSTEM_PROMPT } from '@/lib/chatPrompt'

export async function GET() {
  const db = getDb()
  return NextResponse.json(listConversations(db))
}

export async function POST(request: Request) {
  const body = await request.json()
  const conversationId: number | null = body.conversationId ?? null
  const message: string = body.message ?? ''

  if (!message.trim()) {
    return NextResponse.json({ error: 'empty_message' }, { status: 400 })
  }

  const db = getDb()
  let convId = conversationId
  if (convId === null) {
    convId = createConversation(db)
  } else if (!getConversation(db, convId)) {
    return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
  }

  addMessage(db, convId, 'user', message)

  const conversation = getConversation(db, convId)!
  const aiMessages = [
    { role: 'system' as const, content: CHAT_SYSTEM_PROMPT },
    ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  try {
    const reply = await callQwenMessages(aiMessages)
    addMessage(db, convId, 'assistant', reply)
  } catch (err) {
    // Tin nhắn người dùng vẫn đã được lưu ở trên — trả kèm cuộc hội thoại hiện
    // tại để giao diện không mất tin nhắn đó, chỉ thiếu câu trả lời.
    const partialConversation = getConversation(db, convId)!
    return NextResponse.json(
      { error: 'ai_error', message: (err as Error).message, conversation: partialConversation },
      { status: 500 }
    )
  }

  const finalConversation = getConversation(db, convId)!
  return NextResponse.json(finalConversation)
}
