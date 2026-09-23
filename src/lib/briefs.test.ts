import { describe, it, expect } from 'vitest'
import { createDb } from './db'
import { createBrief, getBrief, normalizeBrief } from './briefs'

describe('Structured Brief', () => {
  it('không field nào bắt buộc — object rỗng vẫn tạo ra brief hợp lệ với default hợp lý', () => {
    const brief = normalizeBrief({})
    expect(brief.contentType).toBe('social_post')
    expect(brief.length).toBe('medium')
    expect(brief.language).toBe('vi')
    expect(brief.tones).toEqual([])
  })

  it('giữ lại đúng các field hợp lệ người dùng cung cấp', () => {
    const brief = normalizeBrief({
      contentType: 'event_recap',
      tones: ['professional', 'human', 'khong_hop_le'],
      length: 'short',
      audience: 'Khách hàng',
      keyMessages: 'Campus tour cùng Arena Multimedia',
    })
    expect(brief.contentType).toBe('event_recap')
    expect(brief.tones).toEqual(['professional', 'human'])
    expect(brief.length).toBe('short')
    expect(brief.audience).toBe('Khách hàng')
    expect(brief.keyMessages).toBe('Campus tour cùng Arena Multimedia')
  })

  it('contentType/length không hợp lệ thì rơi về default thay vì throw', () => {
    const brief = normalizeBrief({ contentType: 'khong_ton_tai', length: 'huge' })
    expect(brief.contentType).toBe('social_post')
    expect(brief.length).toBe('medium')
  })

  it('lưu và đọc lại brief từ CSDL cho đúng dữ liệu', () => {
    const db = createDb(':memory:')
    const { id } = createBrief(db, null, { contentType: 'email', audience: 'Nội bộ' })
    const brief = getBrief(db, id)
    expect(brief?.contentType).toBe('email')
    expect(brief?.audience).toBe('Nội bộ')
    db.close()
  })

  it('getBrief trả undefined nếu id không tồn tại', () => {
    const db = createDb(':memory:')
    expect(getBrief(db, 9999)).toBeUndefined()
    db.close()
  })
})
