# Trợ lý viết nội dung dạng Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (thực thi tại chỗ, task-by-task, TDD).

**Goal:** Thêm trang `/chat` mới — người dùng trò chuyện nhiều lượt với bot để mô tả nội dung muốn viết, bot tự hỏi thêm khi thiếu thông tin, viết nội dung ngay trong khung chat, và tiếp tục hỗ trợ chỉnh sửa/dịch qua hội thoại tự nhiên. Không đổi gì ở trang chính/`/history` hiện có.

**Architecture:** 2 bảng CSDL mới (`chat_conversations`, `chat_messages`) lưu hội thoại. 1 hằng số `CHAT_SYSTEM_PROMPT` gửi kèm mỗi lần gọi AI, chứa toàn bộ logic hỏi-đáp (AI tự quyết định hỏi gì/khi nào viết bài — không có state machine cứng trong code). `qwenClient.ts` được mở rộng thêm `callQwenMessages` để gửi được nhiều lượt hội thoại (không chỉ 1 câu như `callQwen` cũ). Route `POST /api/chat` lưu tin nhắn người dùng, gửi toàn bộ lịch sử cho AI, lưu câu trả lời, trả về cả cuộc hội thoại.

**Tech Stack:** Next.js App Router, better-sqlite3, Vitest — không đổi so với trước.

**Spec:** [docs/superpowers/specs/2026-09-17-chat-tro-ly-design.md](../specs/2026-09-17-chat-tro-ly-design.md)

## Global Constraints

- Không đổi gì ở trang chính (`/`), `/history`, hoặc các route `generate`/`regenerate`/`translate` hiện có — tính năng chat hoàn toàn tách biệt, không chia sẻ dữ liệu với `runs`/`run_outputs`.
- `callQwen(prompt)` hiện tại phải giữ nguyên hành vi y hệt cho mọi chỗ đang dùng nó (`generate`, `regenerate`, `translate`) — không được đổi chữ ký hay cách nó gửi request.
- Câu chào mở đầu là **chuỗi cố định viết trong code**, không gọi AI, không lưu vào CSDL cho tới khi người dùng gửi tin nhắn thật đầu tiên.
- Khi AI lỗi giữa hội thoại: tin nhắn người dùng vừa gửi vẫn phải còn nguyên trong CSDL và trong phản hồi trả về — không được để mất.
- Không viết test tự động cho giao diện thuần (`chat/page.tsx`, CSS) — theo đúng quy ước đã dùng xuyên suốt dự án; kiểm tra bằng tay qua trình duyệt thật ở bước cuối.
- Làm trên nhánh git `feature/chat-tro-ly-viet-noi-dung` hiện tại — không tạo nhánh mới, không đụng `main`.

---

## Task 1: Kiểu dữ liệu cho Chat

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: không có
- Produces: `ChatRole = 'user' | 'assistant'`; `ChatMessage { id, conversationId, role, content, createdAt }`; `ChatConversation { id, createdAt, messages: ChatMessage[] }`; `ChatConversationSummary { id, createdAt, preview }`.

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/types.ts` để lấy đúng nội dung đang có (không xoá gì, chỉ thêm vào cuối file).

- [ ] **Step 2: Thêm vào cuối `src/types.ts`**

```typescript

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: number
  conversationId: number
  role: ChatRole
  content: string
  createdAt: string
}

export interface ChatConversation {
  id: number
  createdAt: string
  messages: ChatMessage[]
}

export interface ChatConversationSummary {
  id: number
  createdAt: string
  preview: string
}
```

- [ ] **Step 3: Kiểm tra kiểu dữ liệu sạch**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "Thêm kiểu dữ liệu cho tính năng Chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: CSDL cho Chat

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: không có
- Produces: `createDb(dbPath)` tạo thêm 2 bảng `chat_conversations` (id, created_at) và `chat_messages` (id, conversation_id, role, content, created_at).

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/lib/db.ts` và `src/lib/db.test.ts` để lấy đúng nội dung đang có (không xoá gì của `runs`/`run_outputs`).

- [ ] **Step 2: Thêm test trước vào cuối describe block `'createDb'` trong `src/lib/db.test.ts`**

```typescript
  it('tạo thêm 2 bảng chat_conversations và chat_messages', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['chat_conversations', 'chat_messages']))
    db.close()
  })

  it('chat_messages có đủ cột conversation_id, role, content, created_at', () => {
    const db = createDb(':memory:')
    const columns = db.prepare('PRAGMA table_info(chat_messages)').all() as { name: string }[]
    const names = columns.map((c) => c.name)
    expect(names).toEqual(expect.arrayContaining(['conversation_id', 'role', 'content', 'created_at']))
    db.close()
  })
```

- [ ] **Step 3: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/db.test.ts
```

- [ ] **Step 4: Sửa `src/lib/db.ts` — thêm 2 bảng mới vào khối `db.exec` bên trong `createDb`, ngay sau khối tạo `run_outputs`**

Tìm đoạn:
```typescript
    CREATE TABLE IF NOT EXISTS run_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id),
      branch TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      edited_content TEXT,
      regenerate_note TEXT,
      source_output_id INTEGER REFERENCES run_outputs(id)
    );
  `)
```

Đổi thành:
```typescript
    CREATE TABLE IF NOT EXISTS run_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id),
      branch TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      edited_content TEXT,
      regenerate_note TEXT,
      source_output_id INTEGER REFERENCES run_outputs(id)
    );

    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
```

Không sửa gì khác trong file (giữ nguyên `migrateRunOutputsSchema`, `getDb`...).

- [ ] **Step 5: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/db.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "Thêm bảng chat_conversations và chat_messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Thư viện truy vấn Chat

**Files:**
- Create: `src/lib/chat.ts`
- Create: `src/lib/chat.test.ts`

**Interfaces:**
- Consumes: `ChatRole`, `ChatMessage`, `ChatConversation`, `ChatConversationSummary` (Task 1); bảng `chat_conversations`/`chat_messages` (Task 2)
- Produces: `createConversation(db): number`; `addMessage(db, conversationId, role, content): ChatMessage`; `getConversation(db, conversationId): ChatConversation | undefined`; `listConversations(db, limit = 50): ChatConversationSummary[]`.

- [ ] **Step 1: Viết test trước — `src/lib/chat.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDb } from './db'
import { createConversation, addMessage, getConversation, listConversations } from './chat'

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
})
```

- [ ] **Step 2: Chạy test, xác nhận fail** (file `chat.ts` chưa tồn tại)

```bash
npx vitest run src/lib/chat.test.ts
```

- [ ] **Step 3: Viết `src/lib/chat.ts`**

```typescript
import type Database from 'better-sqlite3'
import type { ChatConversation, ChatConversationSummary, ChatMessage, ChatRole } from '@/types'

function rowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }
}

export function createConversation(db: Database.Database): number {
  const info = db.prepare('INSERT INTO chat_conversations DEFAULT VALUES').run()
  return info.lastInsertRowid as number
}

export function addMessage(
  db: Database.Database,
  conversationId: number,
  role: ChatRole,
  content: string
): ChatMessage {
  const info = db
    .prepare('INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)')
    .run(conversationId, role, content)
  const row = db
    .prepare('SELECT created_at FROM chat_messages WHERE id = ?')
    .get(info.lastInsertRowid) as { created_at: string }
  return {
    id: info.lastInsertRowid as number,
    conversationId,
    role,
    content,
    createdAt: row.created_at,
  }
}

export function getConversation(db: Database.Database, conversationId: number): ChatConversation | undefined {
  const convRow = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(conversationId) as any
  if (!convRow) return undefined
  const messageRows = db
    .prepare('SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY id')
    .all(conversationId) as any[]
  return {
    id: convRow.id,
    createdAt: convRow.created_at,
    messages: messageRows.map(rowToMessage),
  }
}

export function listConversations(db: Database.Database, limit = 50): ChatConversationSummary[] {
  const convRows = db
    .prepare('SELECT * FROM chat_conversations ORDER BY id DESC LIMIT ?')
    .all(limit) as any[]
  return convRows.map((convRow) => {
    const firstUserMessage = db
      .prepare(
        "SELECT content FROM chat_messages WHERE conversation_id = ? AND role = 'user' ORDER BY id LIMIT 1"
      )
      .get(convRow.id) as { content: string } | undefined
    const preview = firstUserMessage?.content.slice(0, 80) ?? '(chưa có tin nhắn)'
    return {
      id: convRow.id,
      createdAt: convRow.created_at,
      preview,
    }
  })
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/chat.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat.ts src/lib/chat.test.ts
git commit -m "Thêm thư viện truy vấn hội thoại chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Mở rộng qwenClient hỗ trợ nhiều lượt hội thoại

**Files:**
- Modify: `src/lib/qwenClient.ts`
- Modify: `src/lib/qwenClient.test.ts`

**Interfaces:**
- Consumes: không có
- Produces: `ChatCompletionRole = 'system' | 'user' | 'assistant'`; `ChatCompletionMessage { role: ChatCompletionRole; content: string }`; `callQwenMessages(messages: ChatCompletionMessage[]): Promise<string>` (hàm mới); `callQwen(prompt: string): Promise<string>` (giữ nguyên chữ ký và hành vi, giờ là wrapper gọi `callQwenMessages`).

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/lib/qwenClient.ts` và `src/lib/qwenClient.test.ts` để lấy đúng nội dung đang có — các test hiện tại của `callQwen` PHẢI tiếp tục pass nguyên vẹn sau khi sửa.

- [ ] **Step 2: Thêm test trước vào cuối `src/lib/qwenClient.test.ts`** (bên trong describe hiện có, hoặc thêm describe mới `callQwenMessages` cuối file)

```typescript
describe('callQwenMessages', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.GREENNODE_BASE_URL = 'https://fake-greennode.test/v1'
    process.env.GREENNODE_API_KEY = 'fake-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.resetModules()
  })

  it('gửi đúng mảng messages truyền vào, không bọc thêm gì', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'trả lời' } }] }),
    })
    global.fetch = fetchMock as any

    const { callQwenMessages } = await import('./qwenClient')
    const messages = [
      { role: 'system' as const, content: 'bạn là trợ lý' },
      { role: 'user' as const, content: 'xin chào' },
    ]
    const result = await callQwenMessages(messages)

    expect(result).toBe('trả lời')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages).toEqual(messages)
  })

  it('callQwen vẫn bọc prompt thành đúng 1 tin nhắn role user như trước', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })
    global.fetch = fetchMock as any

    const { callQwen } = await import('./qwenClient')
    await callQwen('prompt bất kỳ')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages).toEqual([{ role: 'user', content: 'prompt bất kỳ' }])
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail** (chưa có `callQwenMessages`)

```bash
npx vitest run src/lib/qwenClient.test.ts
```

- [ ] **Step 4: Sửa `src/lib/qwenClient.ts` — thay toàn bộ nội dung bằng**

```typescript
export class QwenCallError extends Error {}

// Quá thời gian này mà GreenNode chưa trả lời thì bỏ cuộc, để một nhánh treo
// không làm màn hình đứng mãi ở "Đang tạo...".
const REQUEST_TIMEOUT_MS = 60_000

export type ChatCompletionRole = 'system' | 'user' | 'assistant'

export interface ChatCompletionMessage {
  role: ChatCompletionRole
  content: string
}

export async function callQwenMessages(messages: ChatCompletionMessage[]): Promise<string> {
  const baseUrl = process.env.GREENNODE_BASE_URL || ''
  const apiKey = process.env.GREENNODE_API_KEY || ''

  if (!baseUrl) {
    throw new QwenCallError('Chưa cấu hình GREENNODE_BASE_URL')
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GREENNODE_MODEL || 'z-ai/glm-5.3-flash-thirdparty',
        messages,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if ((err as Error)?.name === 'TimeoutError') {
      throw new QwenCallError('GreenNode không phản hồi kịp thời (quá 60 giây)')
    }
    throw new QwenCallError(`Không gọi được GreenNode: ${(err as Error).message}`)
  }

  if (!response.ok) {
    throw new QwenCallError(`GreenNode trả lỗi HTTP ${response.status}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new QwenCallError('GreenNode trả về dữ liệu không đúng định dạng mong đợi')
  }
  return content
}

// Tiện ích cho các chỗ chỉ cần gửi đúng 1 câu (generate/regenerate/translate) —
// giữ nguyên chữ ký cũ để không phải sửa gì ở những nơi đang gọi hàm này.
export async function callQwen(prompt: string): Promise<string> {
  return callQwenMessages([{ role: 'user', content: prompt }])
}
```

- [ ] **Step 5: Chạy lại toàn bộ test của file này, xác nhận pass hết (kể cả các test `callQwen` cũ)**

```bash
npx vitest run src/lib/qwenClient.test.ts
```

- [ ] **Step 6: Chạy toàn bộ suite để chắc chắn generate/regenerate/translate không bị ảnh hưởng**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/qwenClient.ts src/lib/qwenClient.test.ts
git commit -m "Thêm callQwenMessages để gửi được nhiều lượt hội thoại

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: API `POST /api/chat` + `GET /api/chat`

**Files:**
- Create: `src/lib/chatPrompt.ts`
- Create: `src/app/api/chat/route.ts`
- Create: `src/app/api/chat/route.test.ts`

**Interfaces:**
- Consumes: `createConversation`, `addMessage`, `getConversation`, `listConversations` (Task 3); `callQwenMessages` (Task 4); `getDb` (đã có)
- Produces: `CHAT_SYSTEM_PROMPT: string`; route `POST /api/chat` body `{ conversationId: number | null, message: string }` → trả về `ChatConversation` đầy đủ (200) hoặc `{ error, message?, conversation? }` (400/404/500); route `GET /api/chat` → trả về `ChatConversationSummary[]`.

- [ ] **Step 1: Viết `src/lib/chatPrompt.ts`** (không cần test riêng — nội dung được xác minh gián tiếp qua test của route ở Step 3)

```typescript
// Câu lệnh hệ thống cho trang /chat — quyết định toàn bộ cách bot hỏi-đáp và
// khi nào viết bài. Đặt riêng 1 file để dễ chỉnh nội dung mà không đụng vào
// logic gọi API ở route.ts.
export const CHAT_SYSTEM_PROMPT = `Bạn là trợ lý viết nội dung của TED, trò chuyện trực tiếp với người dùng để giúp họ viết nội dung (bài đăng mạng xã hội, thông báo nội bộ, email, tin nhắn...).

Trước khi viết, bạn cần biết 4 điều: (1) loại nội dung, (2) giọng văn mong muốn, (3) đối tượng đọc, (4) độ dài mong muốn. Nếu người dùng đã tự nói rõ điều nào trong tin nhắn của họ, đừng hỏi lại điều đó.

Nếu còn thiếu thông tin quan trọng, hãy hỏi lại ĐÚNG MỘT CÂU HỎI cho điều quan trọng nhất còn thiếu — không hỏi dồn nhiều câu cùng lúc.

Khi đã đủ thông tin hợp lý để viết (không nhất thiết phải hỏi đủ cả 4 điều nếu ngữ cảnh đã đủ rõ), hãy viết nội dung hoàn chỉnh ngay trong tin nhắn trả lời — viết đúng theo bố cục chuẩn ngoài đời thật của loại nội dung đó (ví dụ: bài đăng mạng xã hội cần câu mở đầu thu hút, xuống dòng tách từng ý, có thể kèm hashtag; thông báo nội bộ cần tiêu đề và bố cục trang trọng, rõ ràng).

Sau khi đưa bài xong, hỏi người dùng có cần chỉnh sửa hay làm thêm gì không (dịch sang ngôn ngữ khác, đổi giọng văn, rút ngắn/dài ra, viết nội dung mới...).

Với mọi yêu cầu tiếp theo trong cuộc hội thoại, hãy tự hiểu dựa vào toàn bộ lịch sử phía trên — không hỏi lại những gì đã biết.`
```

- [ ] **Step 2: Viết test trước — `src/app/api/chat/route.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwenMessages: vi.fn(async () => 'phản hồi giả lập'),
}))

import { callQwenMessages } from '@/lib/qwenClient'
import { GET, POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  testDb.exec('DELETE FROM chat_messages; DELETE FROM chat_conversations;')
  vi.mocked(callQwenMessages).mockReset()
  vi.mocked(callQwenMessages).mockResolvedValue('phản hồi giả lập')
})

describe('POST /api/chat', () => {
  it('trả 400 khi tin nhắn rỗng', async () => {
    const res = await POST(makeRequest({ conversationId: null, message: '   ' }))
    expect(res.status).toBe(400)
  })

  it('tin nhắn đầu tiên tự tạo 1 cuộc chat mới, lưu cả 2 lượt', async () => {
    const res = await POST(makeRequest({ conversationId: null, message: 'viết bài thông báo nghỉ lễ' }))
    expect(res.status).toBe(200)
    const conv = await res.json()
    expect(conv.id).toBeTypeOf('number')
    expect(conv.messages).toHaveLength(2)
    expect(conv.messages[0]).toMatchObject({ role: 'user', content: 'viết bài thông báo nghỉ lễ' })
    expect(conv.messages[1]).toMatchObject({ role: 'assistant', content: 'phản hồi giả lập' })
  })

  it('gửi kèm system prompt và toàn bộ lịch sử hội thoại cho AI', async () => {
    const first = await POST(makeRequest({ conversationId: null, message: 'câu đầu' }))
    const conv1 = await first.json()

    await POST(makeRequest({ conversationId: conv1.id, message: 'câu thứ hai' }))

    const lastCallMessages = vi.mocked(callQwenMessages).mock.calls[1][0]
    expect(lastCallMessages[0].role).toBe('system')
    const contents = lastCallMessages.map((m: any) => m.content)
    expect(contents).toContain('câu đầu')
    expect(contents).toContain('phản hồi giả lập')
    expect(contents).toContain('câu thứ hai')
  })

  it('gửi tiếp tin nhắn vào 1 cuộc chat đã có, không tạo cuộc chat mới', async () => {
    const first = await POST(makeRequest({ conversationId: null, message: 'câu đầu' }))
    const conv1 = await first.json()

    const second = await POST(makeRequest({ conversationId: conv1.id, message: 'câu tiếp theo' }))
    const conv2 = await second.json()

    expect(conv2.id).toBe(conv1.id)
    expect(conv2.messages).toHaveLength(4)
  })

  it('trả 404 khi conversationId không tồn tại', async () => {
    const res = await POST(makeRequest({ conversationId: 9999, message: 'xin chào' }))
    expect(res.status).toBe(404)
  })

  it('khi AI lỗi: không lưu tin nhắn trả lời, vẫn giữ tin nhắn người dùng vừa gửi', async () => {
    vi.mocked(callQwenMessages).mockRejectedValueOnce(new Error('lỗi giả lập'))

    const res = await POST(makeRequest({ conversationId: null, message: 'câu hỏi' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('ai_error')
    expect(body.conversation.messages).toHaveLength(1)
    expect(body.conversation.messages[0]).toMatchObject({ role: 'user', content: 'câu hỏi' })
  })
})

describe('GET /api/chat', () => {
  it('trả về mảng rỗng khi chưa có cuộc chat nào', async () => {
    const res = await GET()
    expect(await res.json()).toEqual([])
  })

  it('trả về danh sách cuộc chat, mới nhất trước', async () => {
    await POST(makeRequest({ conversationId: null, message: 'cuộc chat cũ' }))
    await POST(makeRequest({ conversationId: null, message: 'cuộc chat mới' }))

    const res = await GET()
    const list = await res.json()
    expect(list).toHaveLength(2)
    expect(list[0].preview).toContain('cuộc chat mới')
    expect(list[1].preview).toContain('cuộc chat cũ')
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail** (chưa có route)

```bash
npx vitest run src/app/api/chat/route.test.ts
```

- [ ] **Step 4: Viết `src/app/api/chat/route.ts`**

```typescript
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
```

- [ ] **Step 5: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/app/api/chat/route.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/chatPrompt.ts src/app/api/chat/route.ts src/app/api/chat/route.test.ts
git commit -m "Thêm API POST/GET /api/chat cho tính năng Chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: API `GET /api/chat/[id]`

**Files:**
- Create: `src/app/api/chat/[id]/route.ts`
- Create: `src/app/api/chat/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getConversation` (Task 3)
- Produces: route `GET /api/chat/{id}` → trả về `ChatConversation` (200) hoặc `{ error: 'conversation_not_found' }` (404).

- [ ] **Step 1: Viết test trước — `src/app/api/chat/[id]/route.test.ts`**

```typescript
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run "src/app/api/chat/[id]/route.test.ts"
```

- [ ] **Step 3: Viết `src/app/api/chat/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getConversation } from '@/lib/chat'

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
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run "src/app/api/chat/[id]/route.test.ts"
```

- [ ] **Step 5: Chạy toàn bộ suite + kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/chat/[id]/route.ts" "src/app/api/chat/[id]/route.test.ts"
git commit -m "Thêm API GET /api/chat/[id] để mở lại 1 cuộc chat cũ

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Giao diện trang Chat

> Không có test tự động cho phần này (giữ đúng quy ước đã áp dụng nhất quán trong dự án) — kiểm chứng bằng tay ở Task 8.

**Files:**
- Create: `src/app/chat/page.tsx`
- Modify: `src/components/Nav.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `ChatMessage`, `ChatConversation`, `ChatConversationSummary` (Task 1); API `/api/chat`, `/api/chat/[id]` (Task 5, 6)

- [ ] **Step 1: Đọc `src/app/history/page.tsx` và `src/app/globals.css`** để nắm đúng quy ước hiện có (cách parse ngày `parseSqliteUtc`, các token màu `--surface`/`--space-*`/`--radius-*`, mẫu loading/error/empty state).

- [ ] **Step 2: Viết `src/app/chat/page.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChatConversation, ChatConversationSummary, ChatMessage } from '@/types'

const GREETING = 'Xin chào bạn! Hôm nay bạn muốn viết nội dung gì? Cứ mô tả ngắn gọn, mình sẽ hỏi thêm nếu cần.'

// SQLite lưu created_at bằng datetime('now'), tức giờ UTC nhưng KHÔNG kèm dấu
// múi giờ — phải nói rõ đây là UTC thì trình duyệt mới hiện đúng giờ địa phương.
function parseSqliteUtc(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z')
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
        <h1>Chat</h1>
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
              <div className="chat-bubble is-assistant">{GREETING}</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'chat-bubble is-user' : 'chat-bubble is-assistant'}>
                {m.content}
              </div>
            ))}
            {sending && <div className="chat-bubble is-assistant chat-bubble-pending">Đang trả lời...</div>}
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
```

- [ ] **Step 3: Sửa `src/components/Nav.tsx` — thêm mục "Chat" vào mảng `LINKS`, giữa "Trang chính" và "Lịch sử"**

Tìm:
```typescript
const LINKS = [
  { href: '/', label: 'Trang chính' },
  { href: '/history', label: 'Lịch sử' },
]
```
Đổi thành:
```typescript
const LINKS = [
  { href: '/', label: 'Trang chính' },
  { href: '/chat', label: 'Chat' },
  { href: '/history', label: 'Lịch sử' },
]
```

- [ ] **Step 4: Thêm CSS cho trang chat vào cuối `src/app/globals.css`**

```css

/* --------------------------------- Chat page ---------------------------- */
.chat-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: var(--space-4);
  min-height: 60vh;
}

.chat-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.chat-sidebar-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow-y: auto;
}

.chat-sidebar-item {
  width: 100%;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  color: var(--ink-soft);
}

.chat-sidebar-item:hover {
  border-color: var(--vng-orange);
}

.chat-sidebar-item.is-active {
  border-color: var(--vng-orange);
  background: color-mix(in srgb, var(--vng-orange) 12%, var(--surface));
  color: var(--ink);
}

.chat-sidebar-item-date {
  font-size: 0.7rem;
  color: var(--ink-faint);
}

.chat-sidebar-item-preview {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-main {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: var(--shadow-card);
}

.chat-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow-y: auto;
  max-height: 60vh;
}

.chat-bubble {
  max-width: 75%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  white-space: pre-wrap;
  line-height: 1.5;
}

.chat-bubble.is-user {
  align-self: flex-end;
  background: var(--vng-orange);
  color: var(--vng-black-95);
}

.chat-bubble.is-assistant {
  align-self: flex-start;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--ink);
}

.chat-bubble-pending {
  color: var(--ink-faint);
  font-style: italic;
}

.chat-error {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--vng-danger);
  font-size: 0.9rem;
}

.chat-input-row {
  display: flex;
  gap: var(--space-2);
}

.chat-input-row .input {
  flex: 1;
}
```

- [ ] **Step 5: Kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/chat/page.tsx src/components/Nav.tsx src/app/globals.css
git commit -m "Thêm giao diện trang Chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Kiểm tra toàn bộ + xác minh qua trình duyệt thật

**Files:** không có

- [ ] **Step 1: Chạy toàn bộ test + kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

Kỳ vọng: sạch, không lỗi.

- [ ] **Step 2: Khởi động lại dev server, kiểm chứng bằng tay qua trình duyệt thật với AI thật**
  - Vào `/chat`: thấy ngay câu chào cố định, không có độ trễ nào.
  - Gõ 1 yêu cầu thiếu thông tin (vd "viết bài thông báo nghỉ lễ") → bot hỏi lại đúng 1 câu (không hỏi dồn nhiều câu).
  - Trả lời tiếp → bot hoặc hỏi thêm 1 câu nữa, hoặc viết bài luôn nếu đã đủ thông tin hợp lý.
  - Sau khi có bài, bot hỏi "còn cần gì thêm không".
  - Gõ tiếp "dịch sang tiếng Anh" (không bấm nút nào) → bot hiểu và dịch đúng bài vừa viết.
  - Gõ tiếp "viết ngắn lại" → bot hiểu và viết lại ngắn hơn.
  - Trong lúc chờ: thấy "Đang trả lời...", nút Gửi bị khoá.
  - Vào thanh điều hướng: thấy mục "Chat" giữa "Trang chính" và "Lịch sử".
  - Bấm "Bắt đầu chat mới" → quay lại câu chào, cuộc chat cũ vẫn còn trong danh sách bên trái.
  - Bấm vào 1 cuộc chat cũ trong danh sách → mở lại đúng toàn bộ lịch sử, gõ tiếp được bình thường.
  - Tải lại trang (F5) → danh sách cuộc chat cũ vẫn còn (đã lưu CSDL).

- [ ] **Step 3: Nếu phát hiện lỗi ở bước 2, sửa code nguồn liên quan rồi lặp lại từ Step 1.**
