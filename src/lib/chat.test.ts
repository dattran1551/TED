import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDb } from './db'
import { createConversation, addMessage, getConversation, listConversations, deleteConversation } from './chat'

let db: Database.Database

beforeEach(() => {
  db = createDb(':memory:')
})

describe('chat', () => {
  it('createConversation tạo 1 cuộc hội thoại mới, trả về id', () => {
    const id = createConversation(db)
    expect(typeof id).toBe('number')
    expect(getConversation(db, id)).toMatchObject({ id, messages: [] })
  })

  it('addMessage thêm đúng tin nhắn vào đúng cuộc hội thoại', () => {
    const convId = createConversation(db)
    const msg = addMessage(db, convId, 'user', 'xin chào')
    expect(msg).toMatchObject({ conversationId: convId, role: 'user', content: 'xin chào' })

    const conv = getConversation(db, convId)!
    expect(conv.messages).toHaveLength(1)
    expect(conv.messages[0]).toMatchObject({ role: 'user', content: 'xin chào' })
  })

  it('getConversation trả về tin nhắn theo đúng thứ tự đã thêm', () => {
    const convId = createConversation(db)
    addMessage(db, convId, 'user', 'câu 1')
    addMessage(db, convId, 'assistant', 'câu 2')
    addMessage(db, convId, 'user', 'câu 3')

    const conv = getConversation(db, convId)!
    expect(conv.messages.map((m) => m.content)).toEqual(['câu 1', 'câu 2', 'câu 3'])
  })

  it('getConversation trả về undefined khi không có cuộc hội thoại nào mang id đó', () => {
    expect(getConversation(db, 9999)).toBeUndefined()
  })

  it('listConversations trả về mảng rỗng khi chưa có cuộc chat nào', () => {
    expect(listConversations(db)).toEqual([])
  })

  it('listConversations trả về mới nhất trước, kèm đoạn trích tin nhắn đầu tiên của người dùng', () => {
    const conv1 = createConversation(db)
    addMessage(db, conv1, 'user', 'cuộc chat đầu tiên')

    const conv2 = createConversation(db)
    addMessage(db, conv2, 'user', 'cuộc chat thứ hai')

    const list = listConversations(db)
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ id: conv2, preview: 'cuộc chat thứ hai' })
    expect(list[1]).toMatchObject({ id: conv1, preview: 'cuộc chat đầu tiên' })
  })

  it('listConversations không lỗi khi 1 cuộc chat chưa có tin nhắn nào', () => {
    const convId = createConversation(db)
    const list = listConversations(db)
    expect(list).toEqual([{ id: convId, createdAt: expect.any(String), preview: '(chưa có tin nhắn)' }])
  })

  it('deleteConversation xoá cả cuộc chat lẫn toàn bộ tin nhắn của nó', () => {
    const convId = createConversation(db)
    addMessage(db, convId, 'user', 'câu 1')
    addMessage(db, convId, 'assistant', 'câu 2')

    deleteConversation(db, convId)

    expect(getConversation(db, convId)).toBeUndefined()
    const remainingMessages = db
      .prepare('SELECT COUNT(*) as c FROM chat_messages WHERE conversation_id = ?')
      .get(convId) as { c: number }
    expect(remainingMessages.c).toBe(0)
  })

  it('deleteConversation không xoá nhầm cuộc chat khác', () => {
    const convA = createConversation(db)
    addMessage(db, convA, 'user', 'của A')
    const convB = createConversation(db)
    addMessage(db, convB, 'user', 'của B')

    deleteConversation(db, convA)

    expect(getConversation(db, convA)).toBeUndefined()
    expect(getConversation(db, convB)).toMatchObject({ id: convB })
  })
})
