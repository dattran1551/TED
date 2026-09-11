# Spec: Trợ lý viết nội dung (TED)

**Ngày:** 09/09/2026
**Trạng thái:** Đã brainstorm xong, chờ bạn duyệt trước khi lập kế hoạch xây dựng.
**Tài liệu hình ảnh đi kèm:** 2 sơ đồ (cơ chế + luồng sử dụng) tại
https://claude.ai/code/artifact/edb6c158-56e2-4424-b861-4bc212de91ec

---

## 1. Đây là gì

TED, giai đoạn này, chỉ có **một tính năng duy nhất**: "Trợ lý viết nội dung".

Bạn dán vào một đoạn text bất kỳ (không giới hạn ở bài social nữa — có thể là bất kỳ nội dung nào bạn cần viết lại/dịch), chọn muốn ra giọng văn nào, rồi bấm tạo. Hệ thống trả về nhiều bản viết lại cùng lúc, mỗi bản một giọng khác nhau, cộng thêm bản dịch Việt↔Anh nếu bạn muốn — tất cả áp theo một **bảng thuật ngữ** cố định để đảm bảo các bản thực sự khác nhau (khác xưng hô, từ vựng, nhịp câu), chứ không phải chỉ đổi vài chữ bề mặt.

## 2. Ai dùng, chạy ở đâu

- **Người dùng:** chỉ một mình bạn, dùng thử/prototype cá nhân. Không cần đăng nhập, không cần tài khoản, không cần phân quyền.
- **Chạy ở đâu:** cần có 1 link truy cập được từ xa ngay từ đầu (không chỉ chạy trên máy đang code) → deploy bằng Dokploy.

## 3. Công nghệ đã chốt

| Phần | Chọn | Vì sao |
|---|---|---|
| Web app (giao diện + xử lý) | Next.js | Gộp chung giao diện và phần gọi AI trong 1 dự án, dễ chạy thử local, hợp quy mô prototype cá nhân. |
| Model sinh nội dung | Qwen 3.0, gọi qua **GreenNode** | Bạn đã có/sẽ có quyền truy cập qua GreenNode. |
| Lưu trữ dữ liệu | 1 file database nhỏ (SQLite) nằm trong server | Đơn giản, không cần dựng thêm hệ thống database riêng cho 1 người dùng. |
| Nơi chạy | Dokploy | Có sẵn cách deploy, cho link truy cập từ xa. |

**Rủi ro cần xử lý khi build:** SQLite là 1 file nằm trong server. Nếu Dokploy deploy lại (cập nhật code) mà không gắn "ổ đĩa lưu trữ lâu dài" (persistent volume), file này mất theo mỗi lần deploy → **phải cấu hình volume ngay trong lúc build**, không để sau.

**API key:** key gọi GreenNode/Qwen nằm trong file `.env` ở phần chạy server, không bao giờ lộ ra phía trình duyệt. `.env` nằm trong `.gitignore`.

**Việc cần tra cứu lúc build (chưa chốt được vì cần xem tài liệu GreenNode):** cách gọi API chính xác (endpoint, định dạng request/response) và tên biến môi trường cho key. Sẽ xác nhận với bạn key/tài liệu GreenNode trước khi viết phần gọi API.

## 4. Các màn hình

### 4.1. Trang chính

Nội dung & luồng thao tác — xem chi tiết trong sơ đồ "Luồng sử dụng" ở link phía trên. Tóm tắt:

1. Ô nhập text tự do, tối đa **2000 từ** (có bộ đếm từ hiện trực tiếp). Cách đếm: tách theo khoảng trắng — với tiếng Việt sẽ không tuyệt đối chính xác 100% (mỗi "từ" có thể gồm 2 âm tiết) nhưng đủ dùng làm giới hạn thực tế.
2. Panel tuỳ chọn: tick chọn giọng văn muốn ra (Chuyên nghiệp / Trẻ trung / Hài — chọn nhiều), bật/tắt cặp Việt↔Anh.
3. Nút "Tạo nội dung".
4. Khu vực kết quả: mỗi lựa chọn ra 1 thẻ, các thẻ hiện song song. Mỗi thẻ có nút "Dùng bản này", cho sửa tay trực tiếp trong ô text, và nút "Ghi chú, tạo lại" (chỉ tạo lại đúng thẻ đó).

**Ba trạng thái bắt buộc:**
- **Chưa có dữ liệu (rỗng):** ô nhập trống, chưa tick tuỳ chọn nào, khu kết quả chưa hiện gì cả. Nút "Tạo nội dung" bị mờ (không bấm được) cho tới khi có text + tick ít nhất 1 tuỳ chọn.
- **Đang chờ:** sau khi bấm tạo, mỗi thẻ kết quả có trạng thái loading riêng (vì 4 nhánh chạy song song, có thẻ về trước có thẻ về sau — không bắt tất cả xong mới hiện).
- **Lỗi:** thẻ nào gọi AI thất bại thì chỉ thẻ đó báo lỗi + nút "Thử lại", các thẻ khác không bị ảnh hưởng. Nếu mất kết nối hoàn toàn, báo lỗi rõ ràng, không để trắng trang/treo.

### 4.2. Trang bảng thuật ngữ

Sửa các quy tắc quyết định giọng văn: mỗi giọng (Chuyên nghiệp / Trẻ trung / Hài) và quy tắc dịch Việt-Anh có: xưng hô, từ vựng ưu tiên, từ nên tránh, nhịp câu, chính sách emoji. Có nút Lưu.

**V1 chỉ có một bộ bảng thuật ngữ đang hoạt động** (không có nhiều bảng để chọn qua lại giữa các lần chạy) — sửa là sửa thẳng bộ đang dùng. Nếu sau này cần nhiều bộ bảng cho nhiều ngữ cảnh khác nhau, tính sau (xem mục 6).

**Ba trạng thái:**
- **Rỗng (lần đầu mở):** đã có sẵn bảng mặc định (giống ví dụ trong sơ đồ) để không trống trơn, không bắt bạn tự điền từ đầu.
- **Đang chờ:** khi bấm Lưu, nút hiện trạng thái đang lưu.
- **Lỗi:** thiếu ô bắt buộc → báo đỏ ngay ô đó, chưa cho lưu.

### 4.3. Trang lịch sử

Xem lại các lần đã tạo trước đó (đoạn input gốc, các bản đã ra, bản nào đã sửa tay).

**Ba trạng thái:**
- **Rỗng:** chưa chạy lần nào → thông báo "chưa có lịch sử, thử tạo nội dung đầu tiên" kèm nút quay về trang chính.
- **Đang chờ:** đang tải danh sách → loading.
- **Lỗi:** không đọc được dữ liệu → báo lỗi + nút thử lại.

## 5. Cơ chế "đủ rõ chưa" (không cần gọi AI để đoán)

Trước khi tạo, hệ thống kiểm tra: bạn đã tick ít nhất 1 giọng văn HOẶC bật cặp Việt-Anh chưa?

- **Có** → coi là đủ rõ, tiến hành ghép prompt + gọi Qwen ngay.
- **Không** → chặn lại, hỏi bạn bổ sung (chọn ít nhất 1 tuỳ chọn) — **đây là kiểm tra thường (validation), không gọi AI**, nên nhanh và không tốn phí gọi API cho những lượt chưa sẵn sàng.

## 6. Cố tình KHÔNG làm ở bản này (out of scope)

- Không có đăng nhập / tài khoản / nhiều người dùng.
- Không có nhiều bảng thuật ngữ để chọn qua lại — chỉ một bộ đang hoạt động.
- Không giới hạn số lần dùng, không tính phí, không theo dõi sử dụng.
- Không hỗ trợ tệp đính kèm (ảnh, file) — chỉ nhận text dán trực tiếp.
- Không có tính năng nào khác ngoài "Trợ lý viết nội dung" (dù tên gợi ý tầng "Advance" — các tính năng khác, nếu có, sẽ là brainstorm riêng sau).

## 7. Dữ liệu lưu trữ (mức khái niệm, không đi sâu kỹ thuật)

- **Bảng thuật ngữ đang dùng** — 4 dòng quy tắc (3 giọng văn + 1 dòng Việt-Anh), mỗi dòng gồm xưng hô / từ vựng ưu tiên / từ tránh / nhịp câu / emoji.
- **Lịch sử các lần tạo** — mỗi lần tạo lưu: đoạn input gốc, tuỳ chọn đã chọn, và từng bản kết quả (nội dung, đã sửa tay chưa, có lỗi không, ghi chú nếu từng "tạo lại").

## 8. Cách bạn tự kiểm tra khi mình báo "xong" (mỗi phần nhỏ đều theo checklist kiểu này)

- Dán gì đó, không tick gì, bấm tạo → phải bị chặn/hỏi lại, không tự chạy ra bản nào.
- Tick 1 giọng văn, bấm tạo → ra đúng 1 bản.
- Tick cả 3 giọng + bật Việt-Anh → ra đủ 4 bản cùng lúc, không phải đợi bản chậm nhất mới thấy gì.
- Dán đoạn dài hơn 2000 từ → bị chặn, có thông báo rõ.
- Sửa bảng thuật ngữ, lưu, tắt mở lại app → bảng vẫn còn nguyên.
- Tắt mở lại app → lịch sử các lần tạo trước vẫn còn (không mất khi deploy lại).
- Bấm "ghi chú, tạo lại" ở 1 bản → chỉ bản đó đổi, 3 bản còn lại giữ nguyên.
- Rút mạng rồi bấm tạo → thấy thông báo lỗi tử tế, không phải màn hình trắng/treo.

## 9. Bước tiếp theo

Sau khi bạn duyệt spec này, mình sẽ chẻ thành kế hoạch xây dựng nhỏ (`writing-plans`), có thứ tự việc rõ ràng, đưa bạn đọc và đồng ý trước khi bắt đầu code.
