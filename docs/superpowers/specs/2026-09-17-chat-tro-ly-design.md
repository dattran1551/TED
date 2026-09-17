# Trợ lý viết nội dung dạng Chat — Design Spec

## 1. Bối cảnh & mục tiêu

App TED hiện có 1 luồng duy nhất: người dùng dán nội dung/yêu cầu vào form, tick chọn giọng văn, bấm nút, xem 3 bản kết quả hiện thành thẻ song song, chọn 1 bản để dịch/sửa/tạo lại.

Yêu cầu mới: thêm **1 trang chat hoàn toàn mới** (`/chat`), giữ nguyên trang cũ không đổi gì. Ở trang chat, người dùng gõ yêu cầu bằng ngôn ngữ tự nhiên qua nhiều lượt tin nhắn; bot tự hỏi thêm những gì còn thiếu, viết nội dung ngay trong khung chat, và tiếp tục hỗ trợ chỉnh sửa/dịch thông qua hội thoại — không cần nút bấm riêng cho từng hành động.

## 2. Phạm vi

**Có trong lần này:**
- Trang `/chat` mới, thêm vào thanh điều hướng.
- Bot mở lời bằng câu chào cố định khi vào 1 cuộc chat mới, chưa từng gõ gì.
- Bot tự hỏi thêm (từng câu một, không dồn) để biết đủ: loại nội dung, giọng văn, đối tượng đọc, độ dài — bỏ qua những gì người dùng đã tự nói.
- Bot viết nội dung trực tiếp trong tin nhắn trả lời khi đã đủ thông tin cần thiết.
- Sau khi đưa bài, bot chủ động hỏi "còn cần gì thêm không".
- Toàn bộ yêu cầu tiếp theo (dịch, sửa, viết lại, viết bài mới...) được bot tự hiểu qua ngữ cảnh hội thoại, không có nút bấm cho từng hành động.
- Lưu lại các cuộc chat vào CSDL, có danh sách để mở lại/tiếp tục cuộc chat cũ.

**Không làm trong lần này (out of scope):**
- Không đổi gì ở trang chính (`/`) và trang Lịch sử (`/history`) hiện tại — 2 luồng hoàn toàn tách biệt, không chia sẻ dữ liệu.
- Không hiện dần chữ kiểu gõ máy (streaming) — giữ kiểu chờ xong rồi hiện nguyên cục, có chỉ báo "Đang trả lời..." trong lúc chờ (nhất quán với quyết định trước đó trong dự án).
- Không giới hạn/kiểm duyệt nội dung hội thoại ngoài những gì AI tự xử lý.
- Không xoá được cuộc chat cũ (có thể làm sau nếu cần).

## 3. Trải nghiệm người dùng

### 3.1. Vào trang `/chat` lần đầu (chưa có cuộc chat nào đang mở)

Khung chat trống, hiện sẵn 1 bong bóng chat từ bot (câu chào **cố định**, không gọi AI):

> "Xin chào bạn! Hôm nay bạn muốn viết nội dung gì? Cứ mô tả ngắn gọn, mình sẽ hỏi thêm nếu cần."

Câu chào này **chỉ hiện ở giao diện**, không lưu vào CSDL, không gửi cho AI — cuộc chat (bản ghi CSDL) chỉ thực sự được tạo khi người dùng gõ tin nhắn đầu tiên.

### 3.2. Hỏi thêm thông tin

Người dùng gõ ví dụ: *"viết bài thông báo nghỉ lễ"*. Bot nhận thấy thiếu giọng văn/đối tượng đọc/độ dài → hỏi lại **đúng 1 câu** cho tiêu chí quan trọng nhất còn thiếu, ví dụ: *"Bạn muốn giọng văn thế nào — trang trọng, gần gũi hay hài hước?"*. Người dùng trả lời tiếp, bot hỏi câu tiếp theo nếu còn thiếu, cứ thế cho tới khi đủ thông tin hợp lý để viết (không nhất thiết phải hỏi đủ cả 4 tiêu chí nếu ngữ cảnh đã đủ rõ).

### 3.3. Nhận kết quả

Khi đã đủ, bot viết nội dung hoàn chỉnh ngay trong tin nhắn trả lời (đúng bố cục chuẩn thực tế của loại nội dung đó — kế thừa logic đã có ở prompt hiện tại), rồi hỏi thêm: *"Bạn thấy ổn chưa, hay muốn mình chỉnh gì thêm — dịch sang tiếng khác, đổi giọng văn, rút gọn lại...?"*

### 3.4. Chỉnh sửa tiếp qua hội thoại

Người dùng gõ tiếp bất kỳ yêu cầu nào bằng lời — *"dịch sang tiếng Anh"*, *"viết ngắn lại"*, *"đổi qua giọng hài hước hơn"*, *"viết thêm 1 bài khác cho dịp khác"* — bot tự hiểu dựa vào toàn bộ lịch sử hội thoại phía trên và phản hồi phù hợp. Không có nút bấm riêng cho các hành động này.

### 3.5. Trạng thái chờ và lỗi

- Trong lúc chờ bot trả lời: hiện bong bóng "Đang trả lời..." (không khoá hẳn ô nhập, nhưng nút gửi bị vô hiệu hoá tới khi có phản hồi — nhất quán với cách các nút gọi AI khác trong app đã làm).
- Nếu AI lỗi (timeout, lỗi mạng...): hiện thông báo lỗi ngay trong khung chat kèm nút "Thử lại" gửi lại đúng tin nhắn vừa rồi. Tin nhắn của người dùng đã gửi vẫn được giữ nguyên trong lịch sử; không có "câu trả lời rỗng" nào bị lưu vào CSDL.

### 3.6. Danh sách cuộc chat cũ

Trang `/chat` có 1 danh sách các cuộc chat trước đó (mỗi mục hiện thời gian tạo + đoạn trích tin nhắn đầu tiên của người dùng để dễ nhận ra). Bấm vào 1 mục sẽ mở lại toàn bộ lịch sử hội thoại đó và có thể gõ tiếp. Có nút "Bắt đầu chat mới" để quay về trạng thái 3.1.

## 4. Kiến trúc

### 4.1. Dữ liệu (CSDL mới)

Thêm 2 bảng vào `src/lib/db.ts` (cùng chỗ với `runs`/`run_outputs`):

```sql
CREATE TABLE IF NOT EXISTS chat_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id),
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Không cần cột nào khác — không có khái niệm "giọng văn"/"loại nội dung" ở tầng CSDL, vì toàn bộ những thứ đó nằm trong nội dung hội thoại tự nhiên, do AI tự đọc hiểu.

### 4.2. Câu lệnh hệ thống (system prompt)

Hằng số mới `CHAT_SYSTEM_PROMPT` (file `src/lib/chatPrompt.ts`), nội dung định hướng:

- Vai trò: trợ lý viết nội dung qua hội thoại.
- Trước khi viết, cần biết 4 điều: loại nội dung, giọng văn, đối tượng đọc, độ dài. Bỏ qua điều nào người dùng đã tự nói.
- Nếu thiếu, hỏi lại đúng 1 câu cho điều quan trọng nhất còn thiếu — không hỏi dồn.
- Khi đủ để viết hợp lý (không cần tuyệt đối đủ cả 4), viết nội dung hoàn chỉnh ngay trong tin nhắn trả lời, đúng bố cục chuẩn thực tế của loại nội dung đó (kế thừa đúng logic "tự nhận diện loại nội dung, viết đúng bố cục" đã có ở `promptBuilder.ts`).
- Sau khi đưa bài, hỏi có cần chỉnh sửa/làm thêm gì không.
- Các yêu cầu tiếp theo trong cùng hội thoại (dịch, sửa, viết lại, viết bài mới...) đều tự xử lý dựa theo ngữ cảnh phía trên.

### 4.3. Client AI hỗ trợ nhiều lượt hội thoại

`src/lib/qwenClient.ts` hiện chỉ có `callQwen(prompt: string)` — dựng `messages: [{role:'user', content: prompt}]` rồi gọi. Cần tách phần gọi HTTP lõi ra thành hàm mới `callQwenMessages(messages: {role: 'system'|'user'|'assistant', content: string}[]): Promise<string>`; `callQwen(prompt)` trở thành hàm tiện ích gọi `callQwenMessages([{role:'user', content: prompt}])` — không đổi hành vi của `callQwen` với các chỗ đang dùng nó (route generate/regenerate/translate không đổi gì).

### 4.4. API

- **`POST /api/chat`** — body `{ conversationId: number | null, message: string }`.
  1. Nếu `conversationId` là `null`, tạo `chat_conversations` mới.
  2. Lưu tin nhắn người dùng (`role: 'user'`).
  3. Đọc toàn bộ lịch sử tin nhắn của cuộc chat đó theo đúng thứ tự.
  4. Gọi `callQwenMessages([{role:'system', content: CHAT_SYSTEM_PROMPT}, ...lịch sử])`.
  5. Nếu thành công: lưu tin nhắn trả lời (`role: 'assistant'`), trả về `{ conversationId, messages: [...toàn bộ] }`.
  6. Nếu AI lỗi: trả lỗi rõ ràng (vd `{ error: 'ai_error', message }`, status 500), **không** lưu tin nhắn trả lời nào — tin nhắn người dùng ở bước 2 vẫn được giữ nguyên để có thể "Thử lại".

- **`GET /api/chat`** — trả về danh sách cuộc chat (id, `created_at`, đoạn trích tin nhắn đầu tiên của người dùng) để hiện ở mục 3.6, mới nhất trước.

- **`GET /api/chat/[id]`** — trả về toàn bộ tin nhắn của 1 cuộc chat theo đúng thứ tự, để mở lại.

### 4.5. Giao diện

- `src/app/chat/page.tsx` — trang mới:
  - Khung tin nhắn cuộn được (bong bóng người dùng căn phải, bong bóng bot căn trái).
  - Ô nhập + nút gửi ở dưới cùng.
  - Câu chào cố định hiện ngay khi chưa có `conversationId` (state rỗng, không gọi API).
  - Danh sách cuộc chat cũ (thanh bên hoặc phần trên cùng) + nút "Bắt đầu chat mới".
  - Trạng thái "Đang trả lời..." khi đang chờ; nút gửi bị khoá trong lúc chờ.
  - Khi lỗi: bong bóng lỗi kèm nút "Thử lại".
- `src/components/Nav.tsx` — thêm mục "Chat" vào thanh điều hướng.
- `src/app/globals.css` — thêm style cho bong bóng chat, khung nhập, danh sách cuộc chat cũ — theo đúng bộ màu/token thương hiệu VNGGames đã dùng xuyên suốt app.
- `src/types.ts` — thêm `ChatRole = 'user' | 'assistant'`, `ChatMessage`, `ChatConversation`.

## 5. Xử lý lỗi

| Tình huống | Xử lý |
|---|---|
| AI timeout/lỗi mạng khi trả lời | Trả lỗi rõ ràng, không lưu tin nhắn trả lời rỗng/hỏng vào CSDL; giao diện hiện nút "Thử lại" gửi lại đúng tin nhắn đó |
| `conversationId` không tồn tại (vd gõ tay URL sai) | API trả 404 |
| Tin nhắn rỗng | Không cho gửi (chặn ở giao diện, nút gửi disable khi ô nhập trống) |

## 6. Kiểm thử

- Test cho các hàm CSDL mới (tạo cuộc chat, thêm tin nhắn, đọc lại đúng thứ tự).
- Test cho `callQwenMessages` (gửi đúng mảng `messages`, `callQwen` cũ vẫn hoạt động y hệt qua wrapper mới).
- Test cho route `POST /api/chat` (tạo cuộc chat mới ở tin nhắn đầu, nối tiếp đúng cuộc chat có sẵn, gửi đúng system prompt + lịch sử cho AI, lỗi AI không làm hỏng tin nhắn người dùng đã lưu).
- Test cho `GET /api/chat` và `GET /api/chat/[id]`.
- Không viết test tự động cho giao diện thuần (`chat/page.tsx`) — theo đúng quy ước đã áp dụng nhất quán trong toàn bộ dự án này; kiểm tra bằng tay qua trình duyệt thật.

## 7. Quyết định đã chốt qua trao đổi

- Thêm trang mới, giữ nguyên trang cũ (không thay thế).
- Mỗi lượt chỉ hỏi giọng văn mong muốn rồi viết đúng 1 bản (không tự động ra cả 3 giọng song song như trang cũ).
- Tiêu chí cần hỏi thêm: loại nội dung, độ dài, đối tượng đọc (ngoài giọng văn).
- Dịch/sửa/viết lại xử lý hoàn toàn qua hội thoại tự nhiên, không có nút riêng.
- Lưu lại lịch sử các cuộc chat để xem/tiếp tục sau.
- Câu chào mở đầu là câu cố định viết sẵn, không gọi AI.
