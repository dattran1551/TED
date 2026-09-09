// Theo dõi công việc sinh nội dung đang chạy nền của từng lượt.
//
// Route /api/generate trả về ngay khi vừa tạo lượt, còn việc gọi AI cho từng
// nhánh vẫn chạy tiếp ở nền. Người dùng thật không cần biết gì về chỗ này —
// màn hình chỉ hỏi lại /api/runs/{id} cho tới khi hết nhánh đang chờ. Nhưng
// bài test thì cần một cách chắc chắn để đợi việc nền chạy xong rồi mới kiểm
// tra kết quả, thay vì ngồi đoán bằng setTimeout.
const inFlight = new Map<number, Promise<void>>()

export function trackRun(runId: number, work: Promise<void>): void {
  inFlight.set(runId, work)
  const cleanup = () => {
    if (inFlight.get(runId) === work) inFlight.delete(runId)
  }
  // Bắt cả hai chiều để chính lời gọi này không bao giờ tạo ra unhandled
  // rejection; việc log lỗi thật là trách nhiệm của phía gọi.
  work.then(cleanup, cleanup)
}

export function waitForRun(runId: number): Promise<void> {
  const work = inFlight.get(runId)
  if (!work) return Promise.resolve()
  return work.catch(() => undefined)
}
