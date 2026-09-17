# Giao diện Glassy + Ảnh nhân vật TED — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (thực thi tại chỗ, TDD nếu có test — phần này thuần giao diện nên không có test tự động).

**Goal:** Đổi headline thành lời chào có tên "Ted", đổi nền trang thành gradient cam-trắng-hồng, đổi khung chat sang phong cách kính mờ (glassy/glossy), và gắn 2 ảnh nhân vật TED (Full body cạnh headline, Profile icon làm avatar chat).

**Architecture:** Đây là thay đổi thuần giao diện (JSX + CSS), không đụng logic gọi API/CSDL nào. Điểm kỹ thuật quan trọng: đảo ngược bảng màu ink/surface/border từ tối sang sáng (an toàn vì sau khi đơn giản hoá `Nav.tsx` ở lần trước, thanh điều hướng không còn dùng các token này — chỉ còn logo ảnh, không có chữ phụ thuộc `--ink`). Thanh điều hướng (`--bg`) giữ nguyên tối, không đổi.

**Tech Stack:** Không đổi.

**Spec:** Không có file spec riêng — 4 yêu cầu cụ thể đã chốt trực tiếp qua hội thoại (Bounded, theo skill brainstorming), đã trình bày lại các lựa chọn cụ thể (màu gradient, bỏ chữ hoa headline, cỡ blur, vị trí ảnh) và được xác nhận.

## Global Constraints

- Không đổi logic/state trong `page.tsx` — chỉ đổi phần JSX hiển thị và CSS.
- Thanh điều hướng (topnav) giữ nguyên nền tối như hiện tại — không đổi, vì logo VNGGames cần nền tối mới đọc rõ được phần chữ trắng.
- 2 file ảnh nằm ở `public/Ted pics/Full body.png` và `public/Ted pics/Profile icon.png` — dùng đúng đường dẫn này, encode dấu cách trong URL thành `%20`.
- Làm trên nhánh git `feature/chat-tro-ly-viet-noi-dung` hiện tại — không tạo nhánh mới, không đụng `main`.

---

## Task 1: Thêm ảnh nhân vật vào git, đổi nền trang + bảng màu chữ sang tông sáng

**Files:**
- Add: `public/Ted pics/Full body.png`, `public/Ted pics/Profile icon.png`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Thêm 2 file ảnh vào git**

```bash
git add "public/Ted pics/Full body.png" "public/Ted pics/Profile icon.png"
```

- [ ] **Step 2: Sửa khối `:root` trong `src/app/globals.css` — tìm**

```css
  --vng-danger: #ff4d6a; /* biến thể sáng hơn của Neon Inferno, đủ tương phản trên nền tối */

  /* Token ngữ nghĩa cho giao diện tối */
  --bg: #1a1819;
  --surface: var(--vng-black-95);
  --surface-2: #423d3e;
  --border: #4d4849;
  --border-soft: #383435;
  --ink: var(--vng-white);
  --ink-soft: var(--vng-gray-10);
  --ink-faint: var(--vng-gray-30);
  --ink-muted: var(--vng-gray-60);
  --focus-ring: var(--vng-gold);
```

Đổi thành:

```css
  --vng-danger: #ff4d6a; /* biến thể sáng hơn của Neon Inferno, đủ tương phản trên nền tối */

  /* Nền trang: gradient cam nhạt -> hồng nhạt trên nền trắng, nhẹ nhàng theo
     hướng "glassy". --bg giữ nguyên tối, CHỈ dùng cho thanh điều hướng (không
     đổi) — không dùng --bg cho nền trang nữa. */
  --page-gradient: linear-gradient(
    160deg,
    #fff9f5 0%,
    #ffe6d5 28%,
    #ffcbae 52%,
    #ffc9dd 76%,
    #fff3f7 100%
  );
  --bg: #1a1819;

  /* Token ngữ nghĩa cho giao diện sáng — panel kính mờ (glass) nổi trên nền
     gradient, nên toàn bộ surface/border giờ là trắng trong suốt thay vì tối.
     An toàn để đổi ink sang màu tối vì Nav giờ chỉ còn logo ảnh, không còn
     chữ nào phụ thuộc các token này. */
  --surface: rgba(255, 255, 255, 0.55);
  --surface-2: rgba(255, 255, 255, 0.38);
  --border: rgba(255, 255, 255, 0.65);
  --border-soft: rgba(255, 255, 255, 0.45);
  --ink: var(--vng-black-95);
  --ink-soft: var(--vng-gray-80);
  --ink-faint: var(--vng-gray-60);
  --ink-muted: var(--vng-gray-60);
  --focus-ring: var(--vng-gold);
  --glass-blur: 18px;
```

- [ ] **Step 3: Sửa `--shadow-card` — tìm**

```css
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px -8px rgba(0, 0, 0, 0.5);
```

Đổi thành (bóng đổ ấm màu cam, nhẹ nhàng hơn, đúng tinh thần "glossy"):

```css
  --shadow-card: 0 8px 32px rgba(240, 90, 34, 0.16), 0 2px 10px rgba(51, 49, 50, 0.08);
```

- [ ] **Step 4: Sửa `body` — tìm**

```css
body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  background: var(--bg);
  font-family: var(--font-body);
```

Đổi thành:

```css
body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  background: var(--page-gradient);
  background-attachment: fixed;
  font-family: var(--font-body);
```

- [ ] **Step 5: Kiểm tra kiểu dữ liệu (không có gì để chạy test, đây là CSS thuần)**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "Đổi nền trang sang gradient cam-hồng, bảng màu chữ sang tông sáng

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Đổi khung chat sang phong cách kính mờ (glassy)

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Thêm hiệu ứng kính mờ cho `.chat-main` — tìm**

```css
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
```

Đổi thành:

```css
.chat-main {
  background: var(--surface);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
```

- [ ] **Step 2: Thêm kính mờ cho thẻ cuộc chat trong sidebar — tìm**

```css
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
```

Đổi thành:

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

- [ ] **Step 3: Làm nổi bật thẻ đang mở — tìm**

```css
.chat-sidebar-item.is-active {
  border-color: var(--vng-orange);
  background: color-mix(in srgb, var(--vng-orange) 12%, var(--surface));
  color: var(--ink);
}
```

Đổi thành:

```css
.chat-sidebar-item.is-active {
  border-color: var(--vng-orange);
  background: color-mix(in srgb, var(--vng-orange) 18%, white 55%);
  color: var(--ink);
}
```

- [ ] **Step 4: Thêm kính mờ cho bong bóng chat của TED — tìm**

```css
.chat-bubble.is-assistant {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--ink);
}
```

Đổi thành:

```css
.chat-bubble.is-assistant {
  background: var(--surface-2);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border);
  color: var(--ink);
}
```

- [ ] **Step 5: Thêm kính mờ cho ô nhập tin nhắn — tìm**

```css
.input {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  color: var(--ink);
  width: 100%;
  transition: border-color 0.15s ease;
}
```

Đổi thành:

```css
.input {
  background: var(--surface-2);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  color: var(--ink);
  width: 100%;
  transition: border-color 0.15s ease;
}
```

- [ ] **Step 6: Kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css
git commit -m "Đổi khung chat sang phong cách kính mờ (glassy)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Đổi headline, gắn ảnh Full body và Profile icon

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Đọc `src/app/page.tsx` hiện tại**

- [ ] **Step 2: Sửa `BotAvatar` — thay toàn bộ hàm**

Tìm:

```tsx
function BotAvatar() {
  return (
    <div className="chat-avatar chat-avatar-bot" aria-hidden="true">
      T
    </div>
  )
}
```

Đổi thành:

```tsx
function BotAvatar() {
  return (
    <img
      src="/Ted%20pics/Profile%20icon.png"
      alt="TED"
      className="chat-avatar chat-avatar-bot"
    />
  )
}
```

- [ ] **Step 3: Sửa phần hero — tìm**

```tsx
      <div className="hero">
        <h1>TED</h1>
        <p className="hero-sub">Trợ lý viết nội dung của bạn</p>
      </div>
```

Đổi thành:

```tsx
      <div className="hero">
        <h1>Xin chào! Mình là Ted - Trợ lý viết nội dung thông minh</h1>
        <img src="/Ted%20pics/Full%20body.png" alt="TED" className="hero-mascot" />
      </div>
```

- [ ] **Step 4: Kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Sửa CSS cho `.chat-avatar-bot` — tìm**

```css
.chat-avatar-bot {
  background: var(--vng-orange);
  color: var(--vng-black-95);
  font-family: var(--font-display);
  font-size: 1.1rem;
}
```

Đổi thành:

```css
.chat-avatar-bot {
  object-fit: cover;
}
```

- [ ] **Step 6: Thêm `overflow: hidden` cho `.chat-avatar` (để ảnh bo tròn đúng khung) — tìm**

```css
.chat-avatar {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

Đổi thành:

```css
.chat-avatar {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
```

- [ ] **Step 7: Sửa layout `.hero` để chứa ảnh nhân vật bên phải, bỏ style chữ hoa cho headline dài — tìm**

```css
.hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.hero-sub {
  color: var(--ink-faint);
  max-width: 46ch;
}
```

Đổi thành:

```css
.hero {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
}

.hero-mascot {
  flex: none;
  height: 180px;
  width: auto;
}

@media (max-width: 640px) {
  .hero {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .hero-mascot {
    height: 120px;
  }
}
```

(Khối `.hero-sub` bị xoá hẳn — không còn dùng, đã gộp nội dung vào headline.)

- [ ] **Step 8: Sửa `h1` — bỏ chữ hoa và giảm cỡ chữ cho phù hợp câu chào dài — tìm**

```css
h1 {
  font-size: clamp(2.5rem, 6vw, 3.75rem);
  line-height: 1.02;
  text-transform: uppercase;
}
```

Đổi thành:

```css
h1 {
  font-size: clamp(1.75rem, 3.4vw, 2.5rem);
  line-height: 1.25;
  text-transform: none;
  flex: 1 1 auto;
  min-width: 0;
}
```

- [ ] **Step 9: Kiểm tra kiểu dữ liệu + chạy toàn bộ test (đảm bảo không đụng logic)**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

- [ ] **Step 10: Xác nhận không còn tham chiếu nào tới `hero-sub` trong `src/`**

```bash
grep -rn "hero-sub" src/
```

Kỳ vọng: không có kết quả nào.

- [ ] **Step 11: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "Thêm headline lời chào và ảnh nhân vật TED (Full body + Profile icon)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Kiểm chứng bằng tay qua trình duyệt thật

**Files:** không có

- [ ] **Step 1: Khởi động lại dev server**

- [ ] **Step 2: Kiểm chứng trực quan**
  - Nền trang là gradient cam nhạt → hồng nhạt, mượt, không chói.
  - Thanh điều hướng trên cùng vẫn tối, logo VNGGames đọc rõ.
  - Headline hiện đúng câu "Xin chào! Mình là Ted - Trợ lý viết nội dung thông minh", chữ thường (không phải IN HOA), màu đủ tối để đọc rõ trên nền sáng.
  - Ảnh TED (Full body) hiện bên phải headline, cỡ vừa phải, không đè lên chữ.
  - Khung chat có hiệu ứng kính mờ rõ ràng (nhìn xuyên thấy mờ mờ nền gradient phía sau khi cuộn/khi có nội dung phía sau).
  - Chữ trong khung chat (bong bóng TED, tên "TED", ngày giờ, placeholder ô nhập) đều đọc rõ, đủ tương phản trên nền sáng.
  - Avatar TED trong khung chat là ảnh Profile icon tròn, không còn chữ "T".
  - Gửi thử 1 tin nhắn, xác nhận toàn bộ luồng hỏi-đáp/viết bài vẫn hoạt động bình thường như trước (không hỏng logic).
  - Thu nhỏ trình duyệt xuống cỡ điện thoại — headline và ảnh TED xếp dọc, không tràn màn hình.

- [ ] **Step 3: Nếu phát hiện lỗi thị giác (tương phản kém, ảnh sai vị trí...), chỉnh CSS liên quan rồi lặp lại Step 2.**
