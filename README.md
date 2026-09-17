# TED — Trợ lý viết nội dung

Trò chuyện trực tiếp với TED để viết nội dung: mô tả bạn muốn viết gì, TED
hỏi lại nếu còn thiếu thông tin (loại nội dung, giọng văn, đối tượng đọc,
độ dài), rồi viết nội dung ngay trong khung chat. Gõ tiếp bằng lời để dịch
sang tiếng Anh/tiếng Hoa, sửa lại, hoặc viết bài mới — không cần nút bấm
riêng. Mọi cuộc chat đều được lưu lại, mở lại xem/tiếp tục được bất cứ lúc
nào.

Một màn hình duy nhất: `/` — trò chuyện với TED.

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
