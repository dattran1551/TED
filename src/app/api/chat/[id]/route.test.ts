import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createConversation, addMessage } from '@/lib/chat'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { GET } from './route'

function makeRequest(id: string) {
  return new Request(`http://localhost/api/chat/${id}`)
}
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  testDb.exec('DELETE FROM chat_messages; DELETE FROM chat_conversations;')
})

describe('GET /api/chat/[id]', () => {
  it('trả 404 khi không có cuộc chat nào mang id đó', async () => {
    const res = await GET(makeRequest('9999'), makeParams('9999'))
    expect(res.status).toBe(404)
  })

  it('trả 404 khi id không phải số', async () => {
    const res = await GET(makeRequest('abc'), makeParams('abc'))
    expect(res.status).toBe(404)
  })

  it('trả về đầy đủ tin nhắn theo đúng thứ tự', async () => {
    const convId = createConversation(testDb)
    addMessage(testDb, convId, 'user', 'câu 1')
    addMessage(testDb, convId, 'assistant', 'câu 2')

    const res = await GET(makeRequest(String(convId)), makeParams(String(convId)))
    expect(res.status).toBe(200)
    const conv = await res.json()
    expect(conv.messages.map((m: any) => m.content)).toEqual(['câu 1', 'câu 2'])
  })
})
