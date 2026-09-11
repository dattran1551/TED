import { describe, it, expect } from 'vitest'
import { buildPrompt, buildRegeneratePrompt } from './promptBuilder'

describe('buildPrompt', () => {
  it('với giọng văn thường: chứa nội dung gốc và tên giọng văn thật', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai')
    expect(prompt).toContain('Bản 2.5 ra mắt thứ Sáu.')
    expect(prompt).toContain('giọng văn: Hài.')
  })

  it('với giọng văn thường: dặn AI tự nhận diện loại nội dung và viết đúng bố cục chuẩn', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai')
    expect(prompt).toContain('nhận diện')
    expect(prompt).toContain('bố cục chuẩn')
  })

  it('với nhánh dich_anh: dùng câu lệnh dịch sang tiếng Anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_anh')
    expect(prompt).toContain('dịch sang tiếng Anh')
    expect(prompt).not.toContain('tiếng Hoa')
  })

  it('với nhánh dich_hoa: dùng câu lệnh dịch sang tiếng Hoa, khác dich_anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_hoa')
    expect(prompt).toContain('dịch sang tiếng Hoa')
    expect(prompt).not.toContain('tiếng Anh')
  })

  it('với bản dịch: dặn AI giữ nguyên bố cục/xuống dòng của bản gốc, chỉ dịch ngôn ngữ', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_anh')
    expect(prompt).toContain('Giữ nguyên bố cục')
  })
})

describe('buildRegeneratePrompt', () => {
  it('nối thêm ghi chú điều chỉnh vào cuối prompt gốc', () => {
    const prompt = buildRegeneratePrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', 'hài hơn nữa')
    expect(prompt).toContain('hài hơn nữa')
    expect(prompt.indexOf('Ghi chú điều chỉnh')).toBeGreaterThan(prompt.indexOf('Bản 2.5 ra mắt thứ Sáu.'))
  })
})
