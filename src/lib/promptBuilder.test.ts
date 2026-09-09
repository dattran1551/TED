import { describe, it, expect } from 'vitest'
import { buildPrompt, buildRegeneratePrompt } from './promptBuilder'
import type { GlossaryRule } from '@/types'

const hai: GlossaryRule = {
  branch: 'hai',
  xungHo: 'tui / bạn',
  tuVungUuTien: 'ẩn dụ phóng đại, tự trào',
  tuTranh: 'giọng nghiêm trọng quá mức',
  nhipCau: 'chốt câu bằng punchline',
  emoji: 'emoji có chọn lọc',
}

const vietAnh: GlossaryRule = {
  branch: 'viet_anh',
  xungHo: 'giữ theo bản gốc',
  tuVungUuTien: 'PvP, skin, buff/nerf',
  tuTranh: 'dịch nghĩa đen thuật ngữ game',
  nhipCau: 'giữ thứ tự thông tin gốc',
  emoji: 'giữ theo bản gốc',
}

describe('buildPrompt', () => {
  it('chứa nội dung gốc và các quy tắc của giọng văn', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', hai)
    expect(prompt).toContain('Bản 2.5 ra mắt thứ Sáu.')
    expect(prompt).toContain('tui / bạn')
    expect(prompt).toContain('chốt câu bằng punchline')
  })

  it('dùng câu lệnh dịch riêng cho nhánh viet_anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'viet_anh', vietAnh)
    expect(prompt).toContain('dịch sang tiếng Anh')
    expect(prompt).toContain('PvP, skin, buff/nerf')
  })
})

describe('buildRegeneratePrompt', () => {
  it('nối thêm ghi chú điều chỉnh vào cuối prompt gốc', () => {
    const prompt = buildRegeneratePrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', hai, 'hài hơn nữa')
    expect(prompt).toContain('hài hơn nữa')
    expect(prompt.indexOf('Ghi chú điều chỉnh')).toBeGreaterThan(prompt.indexOf('Bản 2.5 ra mắt thứ Sáu.'))
  })
})
