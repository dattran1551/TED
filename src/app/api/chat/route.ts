import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createConversation, addMessage, getConversation, listConversations } from '@/lib/chat'
import { streamQwenMessages } from '@/lib/qwenClient'
import { CHAT_SYSTEM_PROMPT } from '@/lib/chatPrompt'
import { STREAM_ERROR_MARKER, buildMetaLine } from '@/lib/chatStreamProtocol'

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

  const generator = streamQwenMessages(aiMessages)

  // Lấy trước mẩu đầu tiên NGOÀI ReadableStream — nếu GreenNode lỗi ngay từ
  // đầu (timeout, HTTP lỗi...), vẫn trả được đúng status code + JSON như
  // luồng không-stream trước đây, không phải đợi bắt đầu gửi response mới
  // biết có lỗi hay không.
  let firstChunk: IteratorResult<string>
  try {
    firstChunk = await generator.next()
  } catch (err) {
    const partialConversation = getConversation(db, convId)!
    return NextResponse.json(
      { error: 'ai_error', message: (err as Error).message, conversation: partialConversation },
      { status: 500 }
    )
  }

  if (firstChunk.done) {
    const partialConversation = getConversation(db, convId)!
    return NextResponse.json(
      {
        error: 'ai_error',
        message: 'TED không tạo được câu trả lời, thử lại nhé.',
        conversation: partialConversation,
      },
      { status: 500 }
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(buildMetaLine(convId)))
      let full = firstChunk.value
      controller.enqueue(encoder.encode(full))

      try {
        while (true) {
          const next = await generator.next()
          if (next.done) break
          full += next.value
          controller.enqueue(encoder.encode(next.value))
        }
        addMessage(db, convId, 'assistant', full)
      } catch (err) {
        // Đã gửi status 200 + bắt đầu stream rồi nên không đổi được mã lỗi
        // HTTP nữa — chèn marker để client tách phần lỗi ra khỏi nội dung đã
        // nhận được. Phần chữ đã sinh ra vẫn được lưu lại, không bỏ phí.
        if (full) addMessage(db, convId, 'assistant', full)
        controller.enqueue(encoder.encode(`${STREAM_ERROR_MARKER}${(err as Error).message}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
