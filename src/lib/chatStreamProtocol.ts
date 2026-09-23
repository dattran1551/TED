// Giao thức đơn giản cho response dạng stream của POST /api/chat:
// dòng đầu tiên là 1 JSON nhỏ (vd. conversationId), các đoạn sau là chữ trả
// lời của TED hiện dần. Nếu lỗi xảy ra GIỮA CHỪNG (sau khi đã bắt đầu stream,
// không còn đổi được mã trạng thái HTTP nữa), phần còn lại chèn thêm marker
// này để phía client tách phần lỗi ra khỏi nội dung đã nhận được.
export const STREAM_ERROR_MARKER = '\n§TED_STREAM_ERROR§:'

export function buildMetaLine(conversationId: number): string {
  return `${JSON.stringify({ conversationId })}\n`
}
