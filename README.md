# TED — Trợ lý viết nội dung

TED là AI content copilot: từ 1 brief, tạo ra cả gói nội dung cho nhiều kênh, đúng giọng thương hiệu, có thể chỉnh sửa/cải thiện/kiểm tra chất lượng ngay trong khung chat.

Một màn hình chính: `/` — trò chuyện với TED. Một màn hình cấu hình: `/brand` — Brand Brain.

## Các khả năng chính

### 1. Structured Brief / Smart Composer
Bấm 1 chip gợi ý (Social Post, Event Recap, Tin tuyển dụng, Email, Thông báo nội bộ) hoặc "Tạo theo Brief" để mở Composer: chọn loại nội dung, kênh (chọn ≥2 kênh để tạo cả gói), giọng văn, độ dài, rồi điền thông điệp chính/CTA/bối cảnh. Không field nào bắt buộc — bỏ trống thì TED tự suy luận. Composer không thay thế chat tự do: vẫn gõ thẳng yêu cầu bằng lời như trước được, TED tự hỏi lại nếu thiếu thông tin quan trọng.

### 2. Brand Brain (`/brand`)
Trang cấu hình giọng thương hiệu: brand voice, quy tắc viết, từ ưu tiên/nên tránh, hướng dẫn CTA/hashtag, và hướng dẫn riêng theo từng kênh. Sửa xong bấm Lưu — mọi nội dung TED tạo ngay sau đó áp dụng bản mới, không cần sửa code hay deploy lại. Dữ liệu lưu trong bảng `brand_profile`, có sẵn 1 bộ mặc định lấy theo giọng VNGGames (tệp `src/lib/brandDefaults.ts`, chỉ là dữ liệu khởi tạo — sửa qua `/brand`, không sửa file này).

### 3. Multi-platform Generation
1 Composer submit với ≥2 kênh sẽ gọi AI **1 lần duy nhất**, trả về JSON có cấu trúc chứa nội dung riêng cho từng kênh (tiết kiệm token, tránh gọi AI lặp lại). Kết quả hiện dạng tab theo kênh ngay trong khung chat. Mỗi tab **regenerate/sửa độc lập** — bấm "Tạo lại" ở tab LinkedIn không đụng tới Facebook/Internal.

### 4. Content Editor + Quick Actions
Mỗi thẻ nội dung có: Copy (có phản hồi "Đã copy ✓"), Sửa tay (không cần gọi AI), Tạo lại, và các Quick Action theo kiến trúc command-driven (1 endpoint `/transform` dùng chung, không lặp prompt cho từng nút): Rút ngắn, Cải thiện câu mở đầu (2 nút chính hiện sẵn), và trong "Thao tác khác": Viết lại, Tự nhiên hơn, Chuyên nghiệp hơn, Dịch (nhập ngôn ngữ đích), Tạo phiên bản khác (trả về nhiều bản khác biệt thật sự, không tự ghi đè — chọn 1 bản để đưa vào ô sửa).

### 5. Content Quality Check (TED Check)
Bấm "TED Check" trên 1 thẻ nội dung để AI chấm theo 8 tiêu chí (giọng thương hiệu, phù hợp đối tượng, thông điệp chính, ngữ pháp, độ dài, lặp ý, CTA, rõ ràng) — trả về trạng thái ✓/⚠/✕ kèm nhận xét ngắn, **không dùng điểm số giả** (ví dụ 83/100). Nếu có vấn đề sửa được, bấm "Fix with TED" — AI chỉ sửa đúng chỗ bị gắn cờ, giữ nguyên phần còn lại. Check lại để xác nhận.

## Kiến trúc prompt (Brand Brain → AI)

Không có 1 prompt khổng lồ viết cứng. `src/lib/promptBuilder.ts` ghép theo lớp cho mỗi tác vụ:

```
SYSTEM INSTRUCTIONS + BRAND CONTEXT (+ CHANNEL RULES) + CONTENT BRIEF (+ NỘI DUNG HIỆN TẠI nếu là sửa) + HỘI THOẠI GẦN ĐÂY + YÊU CẦU
```

`src/lib/ai.ts` (`generateStructured`) ép AI trả JSON đúng cấu trúc, tự thử lại 1 lần nếu JSON sai định dạng, và phân biệt lỗi AI (timeout/HTTP) với lỗi định dạng JSON để trả thông báo phù hợp — không bao giờ làm crash giao diện.

**Lưu ý về thời gian chờ:** model đang dùng (`z-ai/glm-5.3-flash-thirdparty`, qua GreenNode) có bước "suy nghĩ" (reasoning) trước khi trả lời — đo thực tế cho thấy sinh nội dung cho 1 kênh có lúc mất tới ~90-100 giây, gộp nhiều kênh cùng lúc có lúc mất tới ~150 giây. Vì vậy các API sinh/sửa/kiểm tra nội dung dùng timeout dài hơn hẳn API chat thường (60s → tối đa 150-240s tuỳ tác vụ, cấu hình qua tham số `timeoutMs` khi gọi `generateStructured`). Người dùng sẽ thấy khung chat báo "TED đang tạo nội dung..." trong lúc chờ.

## Cấu trúc dữ liệu (SQLite, `data/ted.db`)

Bảng cũ (`chat_conversations`, `chat_messages`) giữ nguyên — chat cũ mở lại vẫn chạy bình thường. Bảng mới, tự tạo khi khởi động (không cần chạy migration tay):

| Bảng | Dùng cho |
|---|---|
| `brand_profile` | Feature #2 — 1 dòng duy nhất, JSON toàn bộ hồ sơ thương hiệu |
| `content_briefs` | Feature #1 — brief đã chuẩn hoá, gắn với 1 cuộc hội thoại |
| `generated_content` | Feature #3 — 1 "gói" (single/package), gắn brief + hội thoại |
| `content_variants` | Feature #3 — mỗi biến thể theo kênh trong 1 gói |
| `quality_checks` | Feature #5 — lịch sử các lần TED Check của 1 biến thể |

Một gói nội dung được gắn vào dòng thời gian chat bằng 1 `chat_message` đặc biệt (nội dung là "content marker" trỏ tới `generated_content.id`, xem `src/lib/contentMarker.ts`) — nhờ vậy không phải đổi schema bảng `chat_messages` cũ, tin nhắn chat thường không bị ảnh hưởng gì.

## Chạy thử trên máy

```bash
npm install
cp .env.example .env.local   # rồi điền GREENNODE_API_KEY và GREENNODE_BASE_URL
npm run dev
```

Mở http://localhost:3000. Không có biến môi trường mới nào so với trước.

`.env.local` chứa khoá thật nên đã nằm trong `.gitignore` — đừng commit nó.
Dữ liệu lưu trong SQLite ở thư mục `data/` (đổi được bằng biến `TED_DATA_DIR`).

## Lệnh khác

```bash
npm test        # chạy toàn bộ test
npm run build   # build bản production
npm run lint    # soát lỗi code
```

## Vendored Skills

- [`superpowers/`](./superpowers) — [obra/superpowers](https://github.com/obra/superpowers), a Claude Code skills library/plugin for TDD, systematic debugging, and subagent-driven development workflows (v6.3.0, snapshot).
- [`emilkowalski-skills/`](./emilkowalski-skills) — [emilkowalski/skills](https://github.com/emilkowalski/skills), design/animation skills for Claude Code (snapshot).
