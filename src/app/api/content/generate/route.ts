import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { addMessage, createConversation, getConversation } from '@/lib/chat'
import { getBrandProfile } from '@/lib/brand'
import { createBrief, normalizeBrief } from '@/lib/briefs'
import { createPackage, type NewVariantInput } from '@/lib/generatedContent'
import { buildContentMarker } from '@/lib/contentMarker'
import { buildGenerationMessages } from '@/lib/promptBuilder'
import { generateStructured, StructuredOutputError } from '@/lib/ai'
import { QwenCallError } from '@/lib/qwenClient'
import { isChannelId, type ChannelId } from '@/lib/config'
import { summarizeBriefForChat } from '@/lib/briefSummary'
import { isGenerationResponse, type GenerationResponse } from '@/lib/generationSchema'

const MAX_CHANNELS = 8

// Model có bước "suy nghĩ" (reasoning) trước khi trả lời — đo thực tế cho
// thấy 1 kênh đơn có lúc mất tới ~97s, gộp 3 kênh có lúc mất tới ~150s. Giãn
// timeout theo số kênh với biên độ an toàn, có trần để tránh treo vô hạn nếu
// model thực sự gặp sự cố (không phải chỉ chậm).
function generationTimeoutMs(channelCount: number): number {
  return Math.min(90_000 + channelCount * 50_000, 240_000)
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const channelsInput = Array.isArray(body.channels) ? body.channels : []
  const channels = channelsInput.filter(isChannelId) as ChannelId[]
  if (channels.length === 0) {
    return NextResponse.json({ error: 'invalid_channels', message: 'Cần chọn ít nhất 1 kênh hợp lệ.' }, { status: 400 })
  }
  if (channels.length > MAX_CHANNELS) {
    return NextResponse.json({ error: 'too_many_channels' }, { status: 400 })
  }

  const db = getDb()

  let conversationId: number | null = typeof body.conversationId === 'number' ? body.conversationId : null
  if (conversationId !== null) {
    if (!getConversation(db, conversationId)) {
      return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
    }
  } else {
    conversationId = createConversation(db)
  }

  const recentMessages = getConversation(db, conversationId)!.messages
  const brand = getBrandProfile(db)
  const brief = normalizeBrief(body.brief)
  const { id: briefId } = createBrief(db, conversationId, brief)

  addMessage(db, conversationId, 'user', summarizeBriefForChat(brief, channels))

  const messages = buildGenerationMessages({ brand, brief, channels, recentMessages })

  let result: GenerationResponse
  try {
    result = await generateStructured(messages, isGenerationResponse, { timeoutMs: generationTimeoutMs(channels.length) })
  } catch (err) {
    const partialConversation = getConversation(db, conversationId)!
    if (err instanceof QwenCallError) {
      return NextResponse.json(
        { error: 'ai_error', message: err.message, conversation: partialConversation },
        { status: 502 }
      )
    }
    if (err instanceof StructuredOutputError) {
      return NextResponse.json(
        {
          error: 'ai_bad_response',
          message: 'TED không tạo được nội dung đúng định dạng, thử lại nhé.',
          conversation: partialConversation,
        },
        { status: 502 }
      )
    }
    throw err
  }

  const variants: NewVariantInput[] = channels
    .map((channel) => {
      const output = result.outputs.find((o) => o.channel === channel)
      if (!output) return null
      return { channel, title: output.title ?? '', content: output.content }
    })
    .filter((v): v is NewVariantInput => v !== null)

  if (variants.length === 0) {
    const partialConversation = getConversation(db, conversationId)!
    return NextResponse.json(
      {
        error: 'ai_bad_response',
        message: 'TED không tạo được nội dung cho các kênh đã chọn, thử lại nhé.',
        conversation: partialConversation,
      },
      { status: 502 }
    )
  }

  const mode = channels.length > 1 ? 'package' : 'single'
  const pkg = createPackage(db, { conversationId, briefId, mode, variants })

  addMessage(db, conversationId, 'assistant', buildContentMarker(pkg.id))

  const conversation = getConversation(db, conversationId)!
  return NextResponse.json({ conversation, package: pkg })
}
