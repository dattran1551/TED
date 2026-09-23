'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChatConversation, ChatConversationSummary, ChatMessage, GeneratedContent } from '@/types'
import { CONTENT_TYPES, labelOf, type ContentTypeId } from '@/lib/config'
import { parseContentMarker } from '@/lib/contentMarker'
import { STREAM_ERROR_MARKER } from '@/lib/chatStreamProtocol'
import { Composer, type ComposerSubmitValue } from '@/components/Composer'
import { ContentPackageView } from '@/components/ContentPackageView'

const GREETING = 'Xin chào bạn! Hôm nay bạn muốn viết nội dung gì? Cứ mô tả ngắn gọn, mình sẽ hỏi thêm nếu cần.'

// Chip "bắt đầu nhanh" ngay dưới headline (mục 11) — bấm vào là mở Composer
// với sẵn loại nội dung tương ứng, không bắt buộc phải gõ chữ trước.
const QUICK_START_TYPES: ContentTypeId[] = ['social_post', 'event_recap', 'recruitment', 'email', 'internal_comm']

// SQLite lưu created_at bằng datetime('now'), tức giờ UTC nhưng KHÔNG kèm dấu
// múi giờ — phải nói rõ đây là UTC thì trình duyệt mới hiện đúng giờ địa phương.
function parseSqliteUtc(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z')
}

function BotAvatar() {
  return (
    <img
      src="/Ted%20pics/Profile%20icon.png"
      alt="TED"
      className="chat-avatar chat-avatar-bot"
    />
  )
}

function UserAvatar() {
  return (
    <div className="chat-avatar chat-avatar-user" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
      </svg>
    </div>
  )
}

function packagesById(conversation: ChatConversation | undefined): Record<number, GeneratedContent> {
  const map: Record<number, GeneratedContent> = {}
  for (const pkg of conversation?.contentPackages ?? []) map[pkg.id] = pkg
  return map
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [packages, setPackages] = useState<Record<number, GeneratedContent>>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerPreset, setComposerPreset] = useState<ContentTypeId | undefined>(undefined)
  const [generating, setGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  function loadConversationList() {
    fetch('/api/chat')
      .then((res) => (res.ok ? res.json() : []))
      .then(setConversations)
      .catch(() => {})
  }

  useEffect(() => {
    loadConversationList()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, generating, streamingText])

  async function sendMessage(text: string) {
    setSending(true)
    setSendError(null)
    setStreamingText('')
    // Hiện tin nhắn của người dùng ngay lập tức (id âm để không trùng id thật
    // từ CSDL) — chờ AI trả lời có khi mất cả chục giây, không hiện ngay thì
    // trông như tin nhắn không được gửi đi. Khi có phản hồi thật, state này bị
    // thay thế hoàn toàn bởi dữ liệu từ server nên không lo trùng/lệch.
    setMessages((prev) => [
      ...prev,
      {
        id: -Date.now(),
        conversationId: conversationId ?? -1,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text }),
      })

      if (!res.ok) {
        // Lỗi xảy ra TRƯỚC khi kịp bắt đầu stream — vẫn là JSON như cũ. Tin
        // nhắn người dùng đã được server lưu lại — đồng bộ để không mất dù
        // câu trả lời của AI bị lỗi.
        const data = await res.json()
        if (data.conversation) {
          setConversationId(data.conversation.id)
          setMessages(data.conversation.messages)
          setPackages(packagesById(data.conversation))
        }
        setLastFailedMessage(text)
        setSendError(data.message ?? 'Không nhận được phản hồi, thử lại nhé.')
        return
      }

      // Đọc dần từng đoạn chữ TED trả lời — hiện ngay khi có, không đợi xong
      // toàn bộ câu trả lời mới thấy gì.
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotMeta = false
      let streamConversationId: number | null = null
      let assistantText = ''
      let streamErrorMessage: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        if (!gotMeta) {
          const newlineIdx = buffer.indexOf('\n')
          if (newlineIdx === -1) continue
          try {
            streamConversationId = JSON.parse(buffer.slice(0, newlineIdx)).conversationId
          } catch {
            // Không đọc được meta thì thôi — vẫn đồng bộ lại bằng GET ở cuối.
          }
          buffer = buffer.slice(newlineIdx + 1)
          gotMeta = true
        }

        const errorIdx = buffer.indexOf(STREAM_ERROR_MARKER)
        if (errorIdx !== -1) {
          assistantText += buffer.slice(0, errorIdx)
          streamErrorMessage = buffer.slice(errorIdx + STREAM_ERROR_MARKER.length)
        } else {
          assistantText += buffer
        }
        buffer = ''
        setStreamingText(assistantText)
      }

      // Đồng bộ lại từ server để lấy đúng id/thời gian thật thay vì chỉ dùng
      // chữ đã ghép được ở client.
      const finalConversationId = streamConversationId ?? conversationId
      if (finalConversationId) {
        const convRes = await fetch(`/api/chat/${finalConversationId}`)
        if (convRes.ok) {
          const conversation: ChatConversation = await convRes.json()
          setConversationId(conversation.id)
          setMessages(conversation.messages)
          setPackages(packagesById(conversation))
        }
      }

      if (streamErrorMessage) {
        setLastFailedMessage(text)
        setSendError(streamErrorMessage)
      } else {
        setLastFailedMessage(null)
      }
      loadConversationList()
    } catch {
      setLastFailedMessage(text)
      setSendError('Không gửi được, kiểm tra kết nối rồi thử lại.')
    } finally {
      setSending(false)
      setStreamingText(null)
    }
  }

  function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    sendMessage(text)
  }

  function handleRetry() {
    if (lastFailedMessage) sendMessage(lastFailedMessage)
  }

  function handleNewChat() {
    setConversationId(null)
    setMessages([])
    setPackages({})
    setSendError(null)
    setLastFailedMessage(null)
    setComposerOpen(false)
  }

  async function handleOpenConversation(id: number) {
    setSendError(null)
    setComposerOpen(false)
    const res = await fetch(`/api/chat/${id}`)
    if (!res.ok) return
    const conversation: ChatConversation = await res.json()
    setConversationId(conversation.id)
    setMessages(conversation.messages)
    setPackages(packagesById(conversation))
  }

  async function handleDeleteConversation(id: number) {
    if (!confirm('Xoá cuộc chat này? Không thể khôi phục lại.')) return
    const res = await fetch(`/api/chat/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    if (id === conversationId) {
      setConversationId(null)
      setMessages([])
      setPackages({})
    }
    loadConversationList()
  }

  function openComposer(preset?: ContentTypeId) {
    setComposerPreset(preset)
    setComposerOpen(true)
    setSendError(null)
  }

  // Feature #1 → #3: Composer thu thập brief có cấu trúc, gửi sang API sinh
  // nội dung đa kênh — gói kết quả được gắn vào ĐÚNG cuộc hội thoại đang mở
  // (hoặc tạo hội thoại mới) để dòng thời gian mạch lạc với chat tự do.
  async function handleComposerSubmit(value: ComposerSubmitValue) {
    setGenerating(true)
    setSendError(null)
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          channels: value.channels,
          brief: {
            contentType: value.contentType,
            tones: value.tones,
            length: value.length,
            audience: value.audience,
            keyMessages: value.keyMessages,
            cta: value.cta,
            additionalContext: value.additionalContext,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.conversation) {
          setConversationId(data.conversation.id)
          setMessages(data.conversation.messages)
          setPackages(packagesById(data.conversation))
        }
        setSendError(data.message ?? 'TED không tạo được nội dung, thử lại nhé.')
        return
      }
      const conversation: ChatConversation = data.conversation
      setConversationId(conversation.id)
      setMessages(conversation.messages)
      setPackages(packagesById(conversation))
      setComposerOpen(false)
      loadConversationList()
    } catch {
      setSendError('Không gửi được yêu cầu, kiểm tra kết nối rồi thử lại.')
    } finally {
      setGenerating(false)
    }
  }

  function handlePackageUpdated(pkg: GeneratedContent) {
    setPackages((prev) => ({ ...prev, [pkg.id]: pkg }))
  }

  return (
    <main className="page-shell">
      <div className="hero">
        <div className="hero-text">
          <h1>Xin chào! Mình là Ted - Trợ lý viết nội dung thông minh</h1>
          <div className="quick-start-row">
            {QUICK_START_TYPES.map((typeId) => (
              <button key={typeId} className="chip" onClick={() => openComposer(typeId)}>
                {labelOf(CONTENT_TYPES, typeId)}
              </button>
            ))}
            <button className="chip chip-outline" onClick={() => openComposer(undefined)}>
              Tạo theo Brief
            </button>
          </div>
        </div>
        <img src="/Ted%20pics/Full%20body.png" alt="TED" className="hero-mascot" />
      </div>

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <button className="btn btn-ghost btn-sm" onClick={handleNewChat}>
            Bắt đầu chat mới
          </button>
          <ul className="chat-sidebar-list">
            {conversations.map((c) => (
              <li key={c.id} className="chat-sidebar-row">
                <button
                  className={c.id === conversationId ? 'chat-sidebar-item is-active' : 'chat-sidebar-item'}
                  onClick={() => handleOpenConversation(c.id)}
                >
                  <span className="chat-sidebar-item-date">
                    {parseSqliteUtc(c.createdAt).toLocaleString('vi-VN')}
                  </span>
                  <span className="chat-sidebar-item-preview">{c.preview}</span>
                </button>
                <button
                  className="chat-sidebar-delete"
                  onClick={() => handleDeleteConversation(c.id)}
                  aria-label="Xoá cuộc chat này"
                  title="Xoá cuộc chat này"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="chat-main">
          <div className="chat-messages">
            {messages.length === 0 && !composerOpen && (
              <div className="chat-message is-assistant">
                <BotAvatar />
                <div className="chat-message-body">
                  <span className="chat-message-name">TED</span>
                  <div className="chat-bubble is-assistant">{GREETING}</div>
                </div>
              </div>
            )}
            {messages.map((m) => {
              const packageId = m.role === 'assistant' ? parseContentMarker(m.content) : null
              if (packageId !== null) {
                const pkg = packages[packageId]
                if (!pkg) return null
                return (
                  <div key={m.id} className="chat-message is-assistant">
                    <BotAvatar />
                    <div className="chat-message-body chat-message-body-wide">
                      <span className="chat-message-name">TED</span>
                      <ContentPackageView package={pkg} onUpdated={handlePackageUpdated} />
                    </div>
                  </div>
                )
              }
              return (
                <div key={m.id} className={m.role === 'user' ? 'chat-message is-user' : 'chat-message is-assistant'}>
                  {m.role === 'user' ? <UserAvatar /> : <BotAvatar />}
                  <div className="chat-message-body">
                    {m.role === 'assistant' && <span className="chat-message-name">TED</span>}
                    <div className={m.role === 'user' ? 'chat-bubble is-user' : 'chat-bubble is-assistant'}>
                      {m.content}
                    </div>
                  </div>
                </div>
              )
            })}
            {sending && (
              <div className="chat-message is-assistant">
                <BotAvatar />
                <div className="chat-message-body">
                  <span className="chat-message-name">TED</span>
                  <div className={streamingText ? 'chat-bubble is-assistant' : 'chat-bubble is-assistant chat-bubble-pending'}>
                    {streamingText || 'Đang trả lời...'}
                  </div>
                </div>
              </div>
            )}
            {generating && (
              <div className="chat-message is-assistant">
                <BotAvatar />
                <div className="chat-message-body">
                  <span className="chat-message-name">TED</span>
                  <div className="chat-bubble is-assistant chat-bubble-pending">TED đang tạo nội dung...</div>
                </div>
              </div>
            )}
            {sendError && (
              <div className="chat-error" role="alert">
                <p>{sendError}</p>
                {lastFailedMessage && (
                  <button className="btn btn-ghost btn-sm" onClick={handleRetry}>
                    Thử lại
                  </button>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {composerOpen && (
            <Composer
              initialContentType={composerPreset}
              submitting={generating}
              onSubmit={handleComposerSubmit}
              onClose={() => setComposerOpen(false)}
            />
          )}

          <div className="chat-input-row">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Nhắn cho trợ lý..."
              disabled={sending}
            />
            <button className="btn btn-primary" onClick={handleSend} disabled={sending || !input.trim()}>
              Gửi
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
