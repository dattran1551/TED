'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChatConversation, ChatConversationSummary, ChatMessage } from '@/types'

const GREETING = 'Xin chào bạn! Hôm nay bạn muốn viết nội dung gì? Cứ mô tả ngắn gọn, mình sẽ hỏi thêm nếu cần.'

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

export default function ChatPage() {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
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
  }, [messages, sending])

  async function sendMessage(text: string) {
    setSending(true)
    setSendError(null)
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
      const data = await res.json()
      if (!res.ok) {
        // Tin nhắn người dùng vẫn được server lưu lại — đồng bộ để không mất
        // dù câu trả lời của AI bị lỗi.
        if (data.conversation) {
          setConversationId(data.conversation.id)
          setMessages(data.conversation.messages)
        }
        setLastFailedMessage(text)
        setSendError(data.message ?? 'Không nhận được phản hồi, thử lại nhé.')
        return
      }
      const conversation: ChatConversation = data
      setConversationId(conversation.id)
      setMessages(conversation.messages)
      setLastFailedMessage(null)
      loadConversationList()
    } catch {
      setLastFailedMessage(text)
      setSendError('Không gửi được, kiểm tra kết nối rồi thử lại.')
    } finally {
      setSending(false)
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
    setSendError(null)
    setLastFailedMessage(null)
  }

  async function handleOpenConversation(id: number) {
    setSendError(null)
    const res = await fetch(`/api/chat/${id}`)
    if (!res.ok) return
    const conversation: ChatConversation = await res.json()
    setConversationId(conversation.id)
    setMessages(conversation.messages)
  }

  return (
    <main className="page-shell">
      <div className="hero">
        <h1>Xin chào! Mình là Ted - Trợ lý viết nội dung thông minh</h1>
        <img src="/Ted%20pics/Full%20body.png" alt="TED" className="hero-mascot" />
      </div>

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <button className="btn btn-ghost btn-sm" onClick={handleNewChat}>
            Bắt đầu chat mới
          </button>
          <ul className="chat-sidebar-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  className={c.id === conversationId ? 'chat-sidebar-item is-active' : 'chat-sidebar-item'}
                  onClick={() => handleOpenConversation(c.id)}
                >
                  <span className="chat-sidebar-item-date">
                    {parseSqliteUtc(c.createdAt).toLocaleString('vi-VN')}
                  </span>
                  <span className="chat-sidebar-item-preview">{c.preview}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="chat-main">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-message is-assistant">
                <BotAvatar />
                <div className="chat-message-body">
                  <span className="chat-message-name">TED</span>
                  <div className="chat-bubble is-assistant">{GREETING}</div>
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'chat-message is-user' : 'chat-message is-assistant'}>
                {m.role === 'user' ? <UserAvatar /> : <BotAvatar />}
                <div className="chat-message-body">
                  {m.role === 'assistant' && <span className="chat-message-name">TED</span>}
                  <div className={m.role === 'user' ? 'chat-bubble is-user' : 'chat-bubble is-assistant'}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="chat-message is-assistant">
                <BotAvatar />
                <div className="chat-message-body">
                  <span className="chat-message-name">TED</span>
                  <div className="chat-bubble is-assistant chat-bubble-pending">Đang trả lời...</div>
                </div>
              </div>
            )}
            {sendError && (
              <div className="chat-error" role="alert">
                <p>{sendError}</p>
                <button className="btn btn-ghost btn-sm" onClick={handleRetry}>
                  Thử lại
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

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
