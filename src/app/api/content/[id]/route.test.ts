import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { createPackage } from '@/lib/generatedContent'
import { GET } from './route'

beforeEach(() => {
  testDb.exec('DELETE FROM content_variants; DELETE FROM generated_content;')
})

describe('GET /api/content/[id]', () => {
  it('trả về gói nội dung kèm biến thể', async () => {
    const pkg = createPackage(testDb, {
      conversationId: null,
      briefId: null,
      mode: 'single',
      variants: [{ channel: 'email', title: '', content: 'nội dung' }],
    })
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: String(pkg.id) }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.variants).toHaveLength(1)
  })

  it('trả 404 khi id không tồn tại', async () => {
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '9999' }) })
    expect(res.status).toBe(404)
  })

  it('trả 400 khi id không phải số', async () => {
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })
})
