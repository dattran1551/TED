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

const dichAnh: GlossaryRule = {
  branch: 'dich_anh',
  xungHo: 'giữ theo bản gốc',
  tuVungUuTien: 'PvP, skin, buff/nerf',
  tuTranh: 'dịch nghĩa đen thuật ngữ game',
  nhipCau: 'giữ thứ tự thông tin gốc',
  emoji: 'giữ theo bản gốc',
}

const dichHoa: GlossaryRule = {
  branch: 'dich_hoa',
  xungHo: 'giữ theo bản gốc',
  tuVungUuTien: 'PvP, skin, buff/nerf',
  tuTranh: 'dịch nghĩa đen thuật ngữ game',
  nhipCau: 'giữ thứ tự thông tin gốc',
  emoji: 'giữ theo bản gốc',
}

describe('buildPrompt', () => {
  it('với giọng văn thường: chứa nội dung gốc, tên giọng văn thật, và quy tắc', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', hai)
    expect(prompt).toContain('Bản 2.5 ra mắt thứ Sáu.')
    expect(prompt).toContain('giọng văn: Hài.')
    expect(prompt).toContain('chốt câu bằng punchline')
  })

  it('với nhánh dich_anh: dùng câu lệnh dịch sang tiếng Anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_anh', dichAnh)
    expect(prompt).toContain('dịch sang tiếng Anh')
    expect(prompt).toContain('PvP, skin, buff/nerf')
    expect(prompt).not.toContain('tiếng Hoa')
  })

  it('với nhánh dich_hoa: dùng câu lệnh dịch sang tiếng Hoa, khác dich_anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_hoa', dichHoa)
    expect(prompt).toContain('dịch sang tiếng Hoa')
    expect(prompt).not.toContain('tiếng Anh')
  })
})

describe('buildRegeneratePrompt', () => {
  it('nối thêm ghi chú điều chỉnh vào cuối prompt gốc', () => {
    const prompt = buildRegeneratePrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', hai, 'hài hơn nữa')
    expect(prompt).toContain('hài hơn nữa')
    expect(prompt.indexOf('Ghi chú điều chỉnh')).toBeGreaterThan(prompt.indexOf('Bản 2.5 ra mắt thứ Sáu.'))
  })
})
