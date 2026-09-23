// Một "gói nội dung" (Feature #3) được gắn vào dòng thời gian chat bằng cách
// lưu 1 chat_message có content là marker này thay vì văn bản thật — bảng
// chat_messages không đổi schema, tin nhắn cũ (không phải marker) hiển thị y
// như trước (tương thích ngược tuyệt đối).
const PREFIX = '§TED_CONTENT§:'

export function buildContentMarker(generatedContentId: number): string {
  return `${PREFIX}${generatedContentId}`
}

export function parseContentMarker(content: string): number | null {
  if (!content.startsWith(PREFIX)) return null
  const id = Number(content.slice(PREFIX.length))
  return Number.isInteger(id) ? id : null
}
