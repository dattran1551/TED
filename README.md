# TED — Trợ lý viết nội dung

Dán một đoạn nội dung vào, chọn giọng văn muốn có (Chuyên nghiệp, Trẻ trung,
Hài) và/hoặc bật dịch Việt ↔ Anh. Ứng dụng gọi model Qwen 3.0 qua GreenNode cho
từng nhánh song song, mỗi nhánh dùng chung một bảng thuật ngữ mà bạn tự sửa
được. Kết quả hiện thành từng thẻ riêng: sửa tay được, ghi chú để tạo lại được,
và mọi lượt đều lưu lại trong lịch sử.

Ba màn hình:

- `/` — nhập nội dung và xem kết quả
- `/glossary` — sửa bảng thuật ngữ dùng chung cho các nhánh
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
