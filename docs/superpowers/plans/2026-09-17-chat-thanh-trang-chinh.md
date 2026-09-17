# Chat thành trang chính + nâng cấp giao diện (tên, avatar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (thực thi tại chỗ, task-by-task, TDD).

**Goal:** Bỏ hẳn trang chính cũ (form + tone-picker + thẻ kết quả) và trang Lịch sử cũ — Chat trở thành giao diện duy nhất, nằm ở route `/`. Nâng cấp giao diện chat để cảm giác như trò chuyện với 1 trợ lý thật: có tên **"TED"** và avatar cho cả bot lẫn người dùng.

**Architecture:** Xoá sạch code của luồng cũ (routes `generate`/`regenerate`/`translate`/`edit-output`/`runs`/`history`, thư viện `runs.ts`/`promptBuilder.ts`/`pendingRuns.ts`/`validation.ts`, component `ResultCard`, các kiểu dữ liệu liên quan) — không giữ lại nửa vời. Nội dung trang `/chat` hiện tại chuyển thẳng vào `src/app/page.tsx` (route `/`), route `/chat` bị xoá. Thanh điều hướng đơn giản hoá chỉ còn logo (không còn nhiều trang để điều hướng). Bảng CSDL `runs`/`run_outputs` ngừng được tạo mới (không xoá bảng cũ nếu ai đã lỡ có dữ liệu — theo đúng cách đã áp dụng khi bỏ Bảng thuật ngữ trước đây).

**Tech Stack:** Không đổi (Next.js App Router, better-sqlite3, Vitest).

**Spec:** Không có file spec riêng — thiết kế chốt trực tiếp qua hội thoại (Bounded, theo skill brainstorming): bỏ trang chính + Lịch sử, tên trợ lý "TED", avatar dạng icon/chữ cái bằng CSS (không dùng ảnh).

## Global Constraints

- Xoá **toàn bộ** code luồng cũ, không để lại phần nửa vời (route rỗng, hàm không ai gọi, kiểu dữ liệu không ai dùng) — kiểm tra bằng `tsc --noEmit` sạch tuyệt đối sau khi xong.
- Không đổi hành vi hiện có của tính năng Chat (hỏi-đáp, viết bài, dịch/sửa qua hội thoại, lưu lịch sử chat, mở lại chat cũ) — chỉ đổi VỊ TRÍ (route) và GIAO DIỆN (avatar/tên), không đổi logic gọi API `/api/chat`.
- File CSDL cũ (đã lỡ có bảng `runs`/`run_outputs`/`glossary_rules` từ trước) phải mở lại được bình thường, không lỗi, không cần xoá tay `data/ted.db` — bảng cũ cứ để nguyên đó, không viết migration xoá bảng.
- Không viết test tự động cho giao diện thuần (`page.tsx`, CSS, `Nav.tsx`) — theo đúng quy ước xuyên suốt dự án; kiểm chứng bằng tay qua trình duyệt thật ở bước cuối.
- Làm trên nhánh git `feature/chat-tro-ly-viet-noi-dung` hiện tại — không tạo nhánh mới, không đụng `main`.

---

## Task 1: Xoá toàn bộ file của luồng cũ

**Files:**
- Delete: `src/app/page.tsx` (trang chính cũ — sẽ có bản thay thế hoàn toàn mới ở Task 3)
- Delete: `src/app/history/page.tsx` (và thư mục `src/app/history`)
- Delete: `src/app/api/generate/route.ts`, `src/app/api/generate/route.test.ts` (và thư mục `src/app/api/generate`)
- Delete: `src/app/api/regenerate/route.ts`, `src/app/api/regenerate/route.test.ts` (và thư mục `src/app/api/regenerate`)
- Delete: `src/app/api/translate/route.ts`, `src/app/api/translate/route.test.ts` (và thư mục `src/app/api/translate`)
- Delete: `src/app/api/edit-output/route.ts` (và thư mục `src/app/api/edit-output`)
- Delete: `src/app/api/runs/[id]/route.ts`, `src/app/api/runs/[id]/route.test.ts` (và thư mục `src/app/api/runs`)
- Delete: `src/app/api/history/route.ts`, `src/app/api/history/route.test.ts` (và thư mục `src/app/api/history`)
- Delete: `src/lib/runs.ts`, `src/lib/runs.test.ts`
- Delete: `src/lib/promptBuilder.ts`, `src/lib/promptBuilder.test.ts`
- Delete: `src/lib/pendingRuns.ts`
- Delete: `src/lib/validation.ts`, `src/lib/validation.test.ts`
- Delete: `src/components/ResultCard.tsx`

**Interfaces:** không có (xoá thuần tuý — Task 2 sẽ dọn nốt các chỗ còn tham chiếu tới các file này)

- [ ] **Step 1: Xoá toàn bộ các file/thư mục trên**

```bash
git rm -r src/app/page.tsx src/app/history src/app/api/generate src/app/api/regenerate src/app/api/translate src/app/api/edit-output src/app/api/runs src/app/api/history src/lib/runs.ts src/lib/runs.test.ts src/lib/promptBuilder.ts src/lib/promptBuilder.test.ts src/lib/pendingRuns.ts src/lib/validation.ts src/lib/validation.test.ts src/components/ResultCard.tsx
```

- [ ] **Step 2: Xác nhận sẽ còn lỗi kiểu dữ liệu ở `qwenClient.ts`/`types.ts`/`db.ts`** (bình thường — Task 2 dọn nốt)

```bash
npx tsc --noEmit
```

Kỳ vọng: còn lỗi liên quan tới `callQwen` không còn ai gọi thì KHÔNG lỗi (không gọi không sao); lỗi thật sự nếu có sẽ là do còn sót file nào đó tham chiếu tới các file vừa xoá — nếu thấy, xoá nốt file đó trước khi qua Task 2.

- [ ] **Step 3: Commit**

```bash
git commit -m "Xoá toàn bộ trang, API và thư viện của luồng cũ (form + tone-picker + Lịch sử)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Dọn kiểu dữ liệu, CSDL và qwenClient

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/db.test.ts`
- Modify: `src/lib/qwenClient.ts`
- Modify: `src/lib/qwenClient.test.ts`

**Interfaces:**
- Consumes: không có
- Produces: `types.ts` chỉ còn `ChatRole`, `ChatMessage`, `ChatConversation`, `ChatConversationSummary`; `db.ts` chỉ còn tạo bảng `chat_conversations`/`chat_messages`; `qwenClient.ts` chỉ còn `callQwenMessages`, `QwenCallError`, `ChatCompletionRole`, `ChatCompletionMessage` (bỏ `callQwen` — không còn ai gọi sau Task 1).

- [ ] **Step 1: Đọc `src/types.ts` hiện tại**

- [ ] **Step 2: Sửa `src/types.ts` — thay toàn bộ nội dung bằng**

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

- [ ] **Step 3: Sửa test trước — thay toàn bộ nội dung `src/lib/db.test.ts` bằng**

```typescript
import { describe, it, expect } from 'vitest'
import { createDb } from './db'

describe('createDb', () => {
  it('tạo 2 bảng chat_conversations và chat_messages', () => {
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

  it('không còn tạo bảng runs/run_outputs của luồng cũ đã bỏ', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).not.toContain('runs')
    expect(tables).not.toContain('run_outputs')
    db.close()
  })

  it('mở lại 1 file CSDL giữa các lần chạy vẫn giữ nguyên dữ liệu đã có', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(os.tmpdir(), `ted-test-persist-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    const db1 = createDb(tmpPath)
    const info = db1.prepare('INSERT INTO chat_conversations DEFAULT VALUES').run()
    db1.close()

    const db2 = createDb(tmpPath)
    const row = db2.prepare('SELECT id FROM chat_conversations WHERE id = ?').get(info.lastInsertRowid) as any
    expect(row.id).toBe(info.lastInsertRowid)

    db2.close()
    fs.unlinkSync(tmpPath)
  })

  it('mở lại 1 file CSDL cũ (còn bảng runs/glossary_rules từ trước khi bỏ luồng cũ) vẫn mở được bình thường', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const RawDatabase = require('better-sqlite3')
    const tmpPath = path.join(
      os.tmpdir(),
      `ted-test-oldschema-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    )

    const oldDb = new RawDatabase(tmpPath)
    oldDb.exec(`
      CREATE TABLE runs (id INTEGER PRIMARY KEY, input_text TEXT);
      CREATE TABLE glossary_rules (branch TEXT PRIMARY KEY);
    `)
    oldDb.close()

    const db = createDb(tmpPath)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['chat_conversations', 'chat_messages']))
    // Bảng cũ vẫn còn nguyên đó (không xoá, không đụng tới) — chỉ là app
    // không còn dùng tới nó nữa.
    expect(tables).toContain('runs')
    expect(tables).toContain('glossary_rules')

    db.close()
    fs.unlinkSync(tmpPath)
  })
})
```

- [ ] **Step 4: Chạy test, xác nhận fail** (vì `db.ts` vẫn còn tạo bảng `runs`/`run_outputs`)

```bash
npx vitest run src/lib/db.test.ts
```

- [ ] **Step 5: Sửa `src/lib/db.ts` — thay toàn bộ nội dung bằng**

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export function createDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  // SQLite mặc định TẮT kiểm tra khoá ngoại, nên ràng buộc chat_messages.conversation_id
  // -> chat_conversations(id) khai báo ở dưới sẽ không có tác dụng nếu không bật dòng này.
  db.pragma('foreign_keys = ON')
  db.exec(`
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
  return db
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  const dataDir = process.env.TED_DATA_DIR || path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  _db = createDb(path.join(dataDir, 'ted.db'))
  return _db
}
```

- [ ] **Step 6: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/db.test.ts
```

- [ ] **Step 7: Đọc `src/lib/qwenClient.ts` và `src/lib/qwenClient.test.ts` hiện tại**

- [ ] **Step 8: Sửa `src/lib/qwenClient.test.ts` — xoá hẳn khối `describe('callQwen', ...)` đầu file (giữ nguyên khối `describe('callQwenMessages', ...)` phía sau)**

File sau khi sửa chỉ còn:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

  it('ném QwenCallError khi API trả lỗi HTTP', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
  })

  it('ném QwenCallError khi response không đúng định dạng', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
  })

  it('báo lỗi rõ ràng khi chưa cấu hình GREENNODE_BASE_URL, không gọi fetch', async () => {
    process.env.GREENNODE_BASE_URL = ''
    const fetchMock = vi.fn()
    global.fetch = fetchMock as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toThrow(
      'Chưa cấu hình GREENNODE_BASE_URL'
    )
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('đổi lỗi hết giờ chờ thành thông báo tiếng Việt dễ hiểu', async () => {
    const timeoutErr = new Error('The operation was aborted due to timeout')
    timeoutErr.name = 'TimeoutError'
    global.fetch = vi.fn().mockRejectedValue(timeoutErr) as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toThrow('không phản hồi kịp thời')
  })

  it('đổi lỗi kết nối cấp thấp thành QwenCallError có ngữ cảnh', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')) as any

    const { callQwenMessages, QwenCallError } = await import('./qwenClient')
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(QwenCallError)
    await expect(callQwenMessages([{ role: 'user', content: 'x' }])).rejects.toThrow(
      'Không gọi được GreenNode: getaddrinfo ENOTFOUND'
    )
  })

  it('gửi kèm tín hiệu huỷ để không treo vô hạn', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })
    global.fetch = fetchMock as any

    const { callQwenMessages } = await import('./qwenClient')
    await callQwenMessages([{ role: 'user', content: 'x' }])
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})
```

(Đã chuyển toàn bộ test case cũ của `callQwen` — vốn chỉ kiểm tra logic lõi của `callQwenMessages` mà `callQwen` từng bọc lại — sang gọi thẳng `callQwenMessages`, không mất độ phủ test nào.)

- [ ] **Step 9: Chạy test, xác nhận fail** (vì `qwenClient.ts` vẫn còn export `callQwen` không ai import trong test mới — thực ra sẽ không fail do TS/JS không ép phải dùng hết export; xác nhận thay vào đó là test vẫn theo đúng hành vi `callQwenMessages` hiện có)

```bash
npx vitest run src/lib/qwenClient.test.ts
```

Kỳ vọng: PASS ngay (vì `callQwenMessages` đã tồn tại từ trước) — bước quan trọng là Step 10 xoá code thừa mà không làm hỏng gì.

- [ ] **Step 10: Sửa `src/lib/qwenClient.ts` — xoá hàm `callQwen`, chỉ giữ lại phần còn dùng**

Xoá đoạn cuối file:
```typescript
// Tiện ích cho các chỗ chỉ cần gửi đúng 1 câu (generate/regenerate/translate) —
// giữ nguyên chữ ký cũ để không phải sửa gì ở những nơi đang gọi hàm này.
export async function callQwen(prompt: string): Promise<string> {
  return callQwenMessages([{ role: 'user', content: prompt }])
}
```

File sau khi xoá kết thúc ngay sau hàm `callQwenMessages`.

- [ ] **Step 11: Chạy lại toàn bộ test + kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

Kỳ vọng: sạch — không còn file nào trong `src/` gọi `callQwen` hay tham chiếu tới các kiểu dữ liệu đã xoá khỏi `types.ts`.

- [ ] **Step 12: Commit**

```bash
git add src/types.ts src/lib/db.ts src/lib/db.test.ts src/lib/qwenClient.ts src/lib/qwenClient.test.ts
git commit -m "Dọn kiểu dữ liệu, CSDL và qwenClient — bỏ hết phần chỉ phục vụ luồng cũ

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Chuyển Chat thành trang chính + đơn giản hoá thanh điều hướng

> Không có test tự động cho phần này — kiểm chứng bằng tay ở Task 6.

**Files:**
- Modify: `src/app/chat/page.tsx` → di chuyển thành `src/app/page.tsx`
- Modify: `src/components/Nav.tsx`

**Interfaces:** không đổi API `/api/chat`, `/api/chat/[id]` đang dùng

- [ ] **Step 1: Đọc `src/app/chat/page.tsx` hiện tại để lấy đúng nội dung** (đã có sẵn tính năng hỏi-đáp, hiện tin nhắn ngay lập tức, danh sách chat cũ...)

- [ ] **Step 2: Di chuyển nội dung sang `src/app/page.tsx`**

```bash
git mv src/app/chat/page.tsx src/app/page.tsx
```

(Nội dung file giữ nguyên ở bước này — Task 4 mới sửa nội dung để thêm avatar/tên. Bước này CHỈ đổi vị trí file.)

- [ ] **Step 3: Xoá thư mục `src/app/chat` nếu còn sót (rỗng sau khi `git mv`)**

```bash
rmdir src/app/chat 2>/dev/null || true
```

- [ ] **Step 4: Sửa `src/components/Nav.tsx` — thay toàn bộ nội dung bằng** (chỉ còn logo, không còn link nào vì giờ chỉ có đúng 1 trang)

```tsx
import Link from 'next/link'

export function Nav() {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="topnav-brand">
          <img src="/vnggames-logo.png" alt="VNGGames" />
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Chuyển Chat thành trang chính (route /), đơn giản hoá thanh điều hướng

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Nâng cấp giao diện — tên "TED" và avatar cho bot/người dùng

> Không có test tự động cho phần này — kiểm chứng bằng tay ở Task 6.

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:** không đổi state/logic gọi API đã có trong `page.tsx` — chỉ đổi phần JSX hiển thị tin nhắn.

- [ ] **Step 1: Đọc `src/app/page.tsx` hiện tại** (đã có sau Task 3)

- [ ] **Step 2: Sửa phần tiêu đề — tìm**

```tsx
      <div className="hero">
        <h1>Chat</h1>
      </div>
```

Đổi thành:

```tsx
      <div className="hero">
        <h1>TED</h1>
        <p className="hero-sub">Trợ lý viết nội dung của bạn</p>
      </div>
```

- [ ] **Step 3: Sửa phần hiện danh sách tin nhắn — tìm nguyên khối**

```tsx
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
```

Đổi thành:

```tsx
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
```

- [ ] **Step 4: Thêm 2 component avatar nhỏ — chèn ngay trước dòng `export default function ChatPage()`**

```tsx
function BotAvatar() {
  return (
    <div className="chat-avatar chat-avatar-bot" aria-hidden="true">
      T
    </div>
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

```

- [ ] **Step 5: Sửa `src/app/globals.css` — tìm khối `.chat-bubble` hiện có (phần "Chat page")**

```css
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
```

Đổi thành (bố cục avatar giờ nằm ở `.chat-message`, `.chat-bubble` không tự căn lề/giới hạn độ rộng nữa mà để `.chat-message-body` lo):

```css
.chat-message {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}

.chat-message.is-user {
  flex-direction: row-reverse;
}

.chat-avatar {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-avatar-bot {
  background: var(--vng-orange);
  color: var(--vng-black-95);
  font-family: var(--font-display);
  font-size: 1.1rem;
}

.chat-avatar-user {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--ink-soft);
}

.chat-message-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 75%;
}

.chat-message.is-user .chat-message-body {
  align-items: flex-end;
}

.chat-message-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-faint);
  padding-inline: var(--space-1);
}

.chat-bubble {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  white-space: pre-wrap;
  line-height: 1.5;
}

.chat-bubble.is-user {
  background: var(--vng-orange);
  color: var(--vng-black-95);
}

.chat-bubble.is-assistant {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--ink);
}
```

Không sửa gì khác trong khối "Chat page" (giữ nguyên `.chat-layout`, `.chat-sidebar*`, `.chat-main`, `.chat-messages`, `.chat-bubble-pending`, `.chat-error`, `.chat-input-row`).

- [ ] **Step 6: Kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "Thêm tên và avatar cho TED và người dùng trong khung chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Dọn CSS chết của luồng cũ

> Không có test tự động cho phần này.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Xoá khối `h3.result-card-title` trong phần Headings**

```css
h3.result-card-title {
  font-size: 1.15rem;
  text-transform: none;
  font-family: var(--font-body);
  font-weight: 700;
}
```

- [ ] **Step 2: Xoá phần link điều hướng trong khối Nav (`.topnav-links`, `.topnav-link`, `.topnav-link:hover`, `.topnav-link.is-active`)** — GIỮ NGUYÊN `.topnav`, `.topnav-inner`, `.topnav-brand`, `.topnav-brand img`.

```css
.topnav-links {
  display: flex;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.topnav-link {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--ink-faint);
  padding-block: var(--space-1);
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.topnav-link:hover {
  color: var(--ink);
}

.topnav-link.is-active {
  color: var(--ink);
  border-bottom-color: var(--vng-orange);
}
```

- [ ] **Step 3: Xoá khối `.loading-text`, `.empty-state`, `.empty-state .link-accent`**

```css
.loading-text,
.empty-state {
  color: var(--ink-faint);
}

.empty-state .link-accent {
  color: var(--vng-orange);
  font-weight: 600;
  border-bottom: 1px solid currentColor;
}
```

- [ ] **Step 4: Xoá toàn bộ phần "Form" TRỪ khối `.input`/`.input::placeholder`/`.input:focus-visible`** — tức xoá `.composer`, `.textarea-main`, `.word-count`, `fieldset`, `.tone-picker legend`, `.tone-picker-options`, toàn bộ `.tone-chip*`, `.composer-messages:empty`.

Khối "Form" sau khi dọn chỉ còn:
```css
/* --------------------------------- Form -------------------------------- */
.input {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  color: var(--ink);
  width: 100%;
  transition: border-color 0.15s ease;
}

.input::placeholder {
  color: var(--ink-muted);
}

.input:focus-visible {
  border-color: var(--vng-orange);
}
```

- [ ] **Step 5: Xoá khối `.alert`**

```css
.alert {
  color: var(--vng-danger);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
```

- [ ] **Step 6: Xoá toàn bộ phần "Result cards"** (từ comment `/* ------------------------------ Result cards ---------------------------- */` cho tới hết `.result-card-note .input`, bao gồm `.results-grid`, media query của nó, `.result-card` + `@keyframes card-in`, mọi `.result-card[data-branch="..."]`, `.result-card-head`, `.result-card-dot`, `.result-card-pending`, `.result-card-text`, `.result-card-error`, `.result-card-edit`, `.result-card-note`, `.result-card-note .input`).

- [ ] **Step 7: Xoá toàn bộ phần "History page"** (từ comment `/* ------------------------------- History page ---------------------------- */` cho tới hết `.history-output-text`).

- [ ] **Step 8: Xoá toàn bộ phần "Chọn bản để dịch"** (từ comment `/* ---------------------------- Chọn bản để dịch --------------------------- */` cho tới hết `.translate-btn[data-target="dich_hoa"]:hover`).

- [ ] **Step 9: Xoá các biến màu nhánh không còn dùng trong khối `:root`**

```css
  /* Extended color — dùng làm màu định danh cho 5 nhánh (3 giọng văn + 2 bản dịch) */
  --tone-chuyen-nghiep: #00f0ff; /* Electric Cyan */
  --tone-re-trung: #b0ff00; /* Cyber Lime */
  --tone-hai: #a259ff; /* Mystic Violet */
  --tone-dich-anh: #2ef0a0; /* Mint Blaze */
  --tone-dich-hoa: #ffe600; /* Neon Lemon */
```

Xoá hẳn 6 dòng trên (kể cả dòng comment), giữ nguyên dòng `--vng-danger: ...` ngay sau đó — nhưng vì `--vng-danger` giờ hết được dùng ở `.alert` (đã xoá) và chỉ còn dùng ở `.chat-error`, vẫn giữ nguyên vì `.chat-error` cần nó.

- [ ] **Step 10: Xác nhận bằng grep không còn tham chiếu nào tới các class/biến vừa xoá trong `src/`**

```bash
grep -rn "result-card\|history-\|tone-chip\|tone-picker\|translate-btn\|topnav-link\b\|loading-text\|empty-state\|className=\"alert\"\|textarea-main\|word-count\|composer\b" src/
grep -rn "\-\-tone-chuyen-nghiep\|\-\-tone-re-trung\|\-\-tone-hai\|\-\-tone-dich-anh\|\-\-tone-dich-hoa" src/
```

Kỳ vọng: không có kết quả nào.

- [ ] **Step 11: Kiểm tra kiểu dữ liệu + chạy toàn bộ test**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

- [ ] **Step 12: Commit**

```bash
git add src/app/globals.css
git commit -m "Dọn CSS chết của trang chính, Lịch sử và thẻ kết quả đã xoá

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Cập nhật metadata, README, kiểm tra toàn bộ + xác minh qua trình duyệt thật

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `README.md`

- [ ] **Step 1: Sửa `src/app/layout.tsx` — cập nhật metadata cho đúng thực tế mới**

Tìm:
```typescript
export const metadata: Metadata = {
  title: "Trợ lý viết nội dung",
  description:
    "Viết lại nội dung theo nhiều giọng văn và dịch Việt-Anh, dùng Qwen 3.0 qua GreenNode.",
};
```

Đổi thành:
```typescript
export const metadata: Metadata = {
  title: "TED — Trợ lý viết nội dung",
  description: "Trò chuyện với TED để viết nội dung theo nhiều giọng văn, dịch được sang tiếng Anh/tiếng Hoa.",
};
```

- [ ] **Step 2: Sửa `README.md` — thay toàn bộ nội dung đoạn mô tả đầu và danh sách màn hình**

Tìm:
```markdown
Dán một đoạn nội dung/yêu cầu vào, chọn giọng văn muốn có (Chuyên nghiệp, Trẻ
trung, Hài). Ứng dụng gọi AI qua GreenNode cho từng nhánh song song, để AI tự
quyết định cách viết đúng chất giọng văn đã chọn. Sau khi có kết quả, chọn 1
bản để dịch tiếp sang Tiếng Anh hoặc Tiếng Hoa. Kết quả hiện thành từng thẻ
riêng: sửa tay được, ghi chú để tạo lại được, và mọi lượt đều lưu lại trong
lịch sử.

Hai màn hình:

- `/` — nhập nội dung, xem kết quả, chọn bản để dịch tiếp
- `/history` — xem lại các lượt đã tạo
```

Đổi thành:
```markdown
Trò chuyện trực tiếp với TED để viết nội dung: mô tả bạn muốn viết gì, TED
hỏi lại nếu còn thiếu thông tin (loại nội dung, giọng văn, đối tượng đọc,
độ dài), rồi viết nội dung ngay trong khung chat. Gõ tiếp bằng lời để dịch
sang tiếng Anh/tiếng Hoa, sửa lại, hoặc viết bài mới — không cần nút bấm
riêng. Mọi cuộc chat đều được lưu lại, mở lại xem/tiếp tục được bất cứ lúc
nào.

Một màn hình duy nhất: `/` — trò chuyện với TED.
```

- [ ] **Step 3: Chạy toàn bộ test + kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

Kỳ vọng: sạch, không lỗi.

- [ ] **Step 4: Khởi động lại dev server, kiểm chứng bằng tay qua trình duyệt thật với AI thật**
  - Vào `/`: thấy ngay khung chat (không còn form/tone-picker cũ), tiêu đề "TED" + dòng phụ đề.
  - Thanh điều hướng chỉ còn logo, không còn link nào.
  - Vào thẳng `/chat` và `/history` (gõ tay URL) → cả hai phải ra 404 (route không còn tồn tại).
  - Câu chào mở đầu hiện kèm avatar "T" màu cam + tên "TED" phía trên bong bóng.
  - Gõ 1 yêu cầu → tin nhắn của mình hiện kèm avatar hình người, avatar TED bên bot vẫn đúng chỗ.
  - Test lại đầy đủ luồng hỏi-đáp → viết bài → dịch/sửa qua hội thoại (như đã làm ở lần kiểm chứng tính năng Chat trước) để chắc không có gì hỏng sau khi đổi route/giao diện.
  - Bấm "Bắt đầu chat mới" và mở lại 1 chat cũ trong sidebar — vẫn hoạt động đúng.
  - Tải lại trang (F5) — lịch sử chat vẫn còn.

- [ ] **Step 5: Nếu phát hiện lỗi ở bước 4, sửa code nguồn liên quan rồi lặp lại từ Step 3.**

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx README.md
git commit -m "Cập nhật metadata và README cho đúng giao diện Chat làm trang chính

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
