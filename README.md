# TED — Trợ lý viết nội dung

Dán một đoạn nội dung/yêu cầu vào, chọn giọng văn muốn có (Chuyên nghiệp, Trẻ
trung, Hài). Ứng dụng gọi AI qua GreenNode cho từng nhánh song song, để AI tự
quyết định cách viết đúng chất giọng văn đã chọn. Sau khi có kết quả, chọn 1
bản để dịch tiếp sang Tiếng Anh hoặc Tiếng Hoa. Kết quả hiện thành từng thẻ
riêng: sửa tay được, ghi chú để tạo lại được, và mọi lượt đều lưu lại trong
lịch sử.

Hai màn hình:

- `/` — nhập nội dung, xem kết quả, chọn bản để dịch tiếp
- `/history` — xem lại các lượt đã tạo

## Chạy thử trên máy

```bash
npm install
cp .env.example .env.local   # rồi điền GREENNODE_API_KEY và GREENNODE_BASE_URL
npm run dev
```

Mở http://localhost:3000.

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
