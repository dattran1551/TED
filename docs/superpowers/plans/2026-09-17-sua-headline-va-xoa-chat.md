# Sửa headline/vị trí ảnh + Thêm xoá cuộc chat cũ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** (1) Headline viết in hoa toàn bộ. (2) Ảnh TED đứng sát headline hơn trên PC (đang bị đẩy ra xa do lỗi CSS). (3) Cho phép người dùng tự xoá 1 cuộc chat cũ trong danh sách sidebar.

**Architecture:** (1)(2) thuần CSS. (3) thêm 1 hàm CSDL `deleteConversation`, 1 route `DELETE /api/chat/[id]`, và 1 nút xoá nhỏ trên mỗi mục sidebar — xoá thật (không "ẩn"), có xác nhận trước khi xoá vì không khôi phục lại được.

**Tech Stack:** Không đổi.

**Spec:** Không có file spec riêng — 3 yêu cầu cụ thể chốt trực tiếp qua hội thoại (Bounded).

## Global Constraints

- Xoá cuộc chat là xoá thật khỏi CSDL (cả bảng `chat_conversations` lẫn `chat_messages` liên quan) — phải hỏi xác nhận trước vì không khôi phục lại được.
- Nếu người dùng xoá đúng cuộc chat đang mở, giao diện phải quay về trạng thái "chat mới" (câu chào), không được hiện tin nhắn của 1 cuộc chat đã không còn tồn tại.
- Không viết test tự động cho phần CSS/JSX thuần (headline, vị trí ảnh, nút xoá) — theo đúng quy ước xuyên suốt dự án; có viết test cho phần CSDL/API xoá (đây là logic thật, cần test như mọi route khác).
- Làm trên nhánh git `feature/chat-tro-ly-viet-noi-dung` hiện tại.

---

## Task 1: Headline in hoa toàn bộ

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Sửa `h1` — tìm**

```css
h1 {
  font-size: clamp(1.75rem, 3.4vw, 2.5rem);
  line-height: 1.25;
  text-transform: none;
  flex: 1 1 auto;
  min-width: 0;
}
```

Đổi `text-transform: none;` thành `text-transform: uppercase;` (giữ nguyên mọi dòng khác — dòng `flex: 1 1 auto` sẽ được sửa tiếp ở Task 2):

```css
h1 {
  font-size: clamp(1.75rem, 3.4vw, 2.5rem);
  line-height: 1.25;
  text-transform: uppercase;
  flex: 1 1 auto;
  min-width: 0;
}
```

- [ ] **Step 2: Commit** (gộp chung với Task 2 vì cùng sửa 1 khối `h1`, xem Step cuối Task 2)

---

## Task 2: Ảnh TED đứng sát headline hơn trên PC

**Files:**
- Modify: `src/app/globals.css`

**Nguyên nhân:** `.hero` dùng `justify-content: space-between`, và `h1` có `flex: 1 1 auto` (tự giãn ra chiếm hết khoảng trống còn lại) — khiến khung chứa chữ giãn rộng ra, đẩy ảnh ra tận mép phải dù chữ thực tế ngắn hơn nhiều.

- [ ] **Step 1: Sửa `.hero` — tìm**

```css
.hero {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
}
```

Đổi thành (bỏ `justify-content: space-between`, để 2 phần tử nằm sát nhau theo `gap`):

```css
.hero {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: var(--space-4);
}
```

- [ ] **Step 2: Sửa `h1` — bỏ `flex-grow` để khung chữ không tự giãn ra chiếm chỗ trống (tìm, đã có `text-transform: uppercase` từ Task 1)**

```css
h1 {
  font-size: clamp(1.75rem, 3.4vw, 2.5rem);
  line-height: 1.25;
  text-transform: uppercase;
  flex: 1 1 auto;
  min-width: 0;
}
```

Đổi thành:

```css
h1 {
  font-size: clamp(1.75rem, 3.4vw, 2.5rem);
  line-height: 1.25;
  text-transform: uppercase;
  flex: 0 1 auto;
  min-width: 0;
}
```

- [ ] **Step 3: Kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Kiểm chứng bằng tay trên trình duyệt** — mở trang chính ở cỡ PC, xác nhận ảnh TED đứng sát ngay cạnh khối chữ headline (không còn khoảng trống lớn ở giữa), chữ headline hiện IN HOA.

- [ ] **Step 5: Commit (gộp Task 1 + 2)**

```bash
git add src/app/globals.css
git commit -m "Headline in hoa toàn bộ, sửa ảnh TED đứng sát headline hơn trên PC

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Thư viện — thêm `deleteConversation`

**Files:**
- Modify: `src/lib/chat.ts`
- Modify: `src/lib/chat.test.ts`

**Interfaces:**
- Consumes: không có
- Produces: `deleteConversation(db, conversationId): void` — xoá toàn bộ tin nhắn thuộc cuộc chat đó rồi xoá chính cuộc chat.

- [ ] **Step 1: Thêm test trước vào cuối `src/lib/chat.test.ts`**

```typescript
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
```

Thêm `deleteConversation` vào dòng import đầu file:

```typescript
import { createConversation, addMessage, getConversation, listConversations, deleteConversation } from './chat'
```

- [ ] **Step 2: Chạy test, xác nhận fail** (chưa có hàm)

```bash
npx vitest run src/lib/chat.test.ts
```

- [ ] **Step 3: Thêm hàm vào cuối `src/lib/chat.ts`**

```typescript

export function deleteConversation(db: Database.Database, conversationId: number): void {
  db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(conversationId)
  db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(conversationId)
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/chat.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat.ts src/lib/chat.test.ts
git commit -m "Thêm deleteConversation để xoá hẳn 1 cuộc chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: API `DELETE /api/chat/[id]`

**Files:**
- Modify: `src/app/api/chat/[id]/route.ts`
- Modify: `src/app/api/chat/[id]/route.test.ts`

**Interfaces:**
- Consumes: `deleteConversation` (Task 3)
- Produces: route `DELETE /api/chat/{id}` → `{ success: true }` (200) hoặc `{ error: 'conversation_not_found' }` (404).

- [ ] **Step 1: Thêm test trước vào cuối `src/app/api/chat/[id]/route.test.ts`**

Thêm `DELETE` vào dòng import từ `./route`:

```typescript
import { GET, DELETE } from './route'
```

Thêm describe block mới vào cuối file:

```typescript
describe('DELETE /api/chat/[id]', () => {
  it('trả 404 khi không có cuộc chat nào mang id đó', async () => {
    const res = await DELETE(makeRequest('9999'), makeParams('9999'))
    expect(res.status).toBe(404)
  })

  it('xoá thành công, GET lại trả 404', async () => {
    const convId = createConversation(testDb)
    addMessage(testDb, convId, 'user', 'câu 1')

    const res = await DELETE(makeRequest(String(convId)), makeParams(String(convId)))
    expect(res.status).toBe(200)

    const getRes = await GET(makeRequest(String(convId)), makeParams(String(convId)))
    expect(getRes.status).toBe(404)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail** (chưa có `DELETE` export)

```bash
npx vitest run "src/app/api/chat/[id]/route.test.ts"
```

- [ ] **Step 3: Thêm hàm `DELETE` vào cuối `src/app/api/chat/[id]/route.ts`**

Thêm `deleteConversation` vào import từ `@/lib/chat`:

```typescript
import { getConversation, deleteConversation } from '@/lib/chat'
```

Thêm vào cuối file:

```typescript

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conversationId = Number(id)
  const db = getDb()
  const conversation = getConversation(db, conversationId)
  if (!conversation) {
    return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
  }
  deleteConversation(db, conversationId)
  return NextResponse.json({ success: true })
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
git commit -m "Thêm API DELETE /api/chat/[id] để xoá 1 cuộc chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Giao diện — nút xoá trên mỗi mục sidebar

> Không có test tự động cho phần này — kiểm chứng bằng tay ở Task 6.

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Đọc `src/app/page.tsx` hiện tại**

- [ ] **Step 2: Thêm hàm `handleDeleteConversation` — chèn ngay sau hàm `handleOpenConversation`**

```tsx
  async function handleDeleteConversation(id: number) {
    if (!confirm('Xoá cuộc chat này? Không thể khôi phục lại.')) return
    const res = await fetch(`/api/chat/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    if (id === conversationId) {
      setConversationId(null)
      setMessages([])
    }
    loadConversationList()
  }
```

- [ ] **Step 3: Sửa danh sách sidebar — tìm**

```tsx
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
```

Đổi thành:

```tsx
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
```

- [ ] **Step 4: Kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Thêm CSS cho `.chat-sidebar-row` và `.chat-sidebar-delete` — tìm**

```css
.chat-sidebar-item {
  width: 100%;
  text-align: left;
  background: var(--surface-2);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  color: var(--ink-soft);
  transition: background 0.15s ease, border-color 0.15s ease;
}
```

Đổi thành (thêm `position: relative` và chừa chỗ bên phải cho nút xoá):

```css
.chat-sidebar-row {
  position: relative;
}

.chat-sidebar-item {
  width: 100%;
  text-align: left;
  background: var(--surface-2);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-6) var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  color: var(--ink-soft);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.chat-sidebar-delete {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--ink-faint);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-sidebar-delete:hover {
  background: var(--vng-danger);
  color: white;
}
```

- [ ] **Step 6: Chạy toàn bộ suite + kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "Thêm nút xoá cuộc chat cũ trong sidebar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Kiểm chứng bằng tay qua trình duyệt thật

- [ ] **Step 1: Khởi động lại dev server**

- [ ] **Step 2: Kiểm chứng**
  - Headline hiện IN HOA toàn bộ.
  - Trên PC, ảnh TED đứng sát ngay cạnh khối chữ headline, không còn khoảng trống lớn.
  - Mỗi mục trong danh sách chat cũ có nút "×" nhỏ ở góc phải.
  - Bấm "×" → hiện hộp thoại xác nhận của trình duyệt; bấm Huỷ thì không mất gì.
  - Bấm "×" rồi xác nhận → mục đó biến mất khỏi danh sách, không tải lại trang vẫn thấy mất luôn (đã xoá CSDL thật).
  - Xoá đúng cuộc chat đang mở → khung chat quay về câu chào mặc định, không còn hiện tin nhắn cũ.
  - Xoá 1 cuộc chat KHÔNG phải đang mở → cuộc chat đang xem không bị ảnh hưởng gì.

- [ ] **Step 3: Nếu phát hiện lỗi, sửa rồi lặp lại Step 2.**
