import { describe, it, expect } from 'vitest'
import { createDb } from './db'
import { getBrandProfile, updateBrandProfile, normalizeBrandProfile } from './brand'
import { DEFAULT_BRAND_PROFILE } from './brandDefaults'

describe('Brand Brain', () => {
  it('CSDL mới luôn có sẵn 1 brand profile mặc định', () => {
    const db = createDb(':memory:')
    const profile = getBrandProfile(db)
    expect(profile.brandName).toBe(DEFAULT_BRAND_PROFILE.brandName)
    expect(profile.preferredTerms.length).toBeGreaterThan(0)
    db.close()
  })

  it('cập nhật brand profile thì đọc lại thấy đúng giá trị mới — không cần sửa code/redeploy (yêu cầu 4.7)', () => {
    const db = createDb(':memory:')
    updateBrandProfile(db, {
      ...DEFAULT_BRAND_PROFILE,
      voice: 'Giọng văn hoàn toàn mới để kiểm tra',
      preferredTerms: [{ preferred: 'Siêu Nâng Cấp', avoid: 'Đại Nhảy Vọt' }],
    })
    const profile = getBrandProfile(db)
    expect(profile.voice).toBe('Giọng văn hoàn toàn mới để kiểm tra')
    expect(profile.preferredTerms).toEqual([{ preferred: 'Siêu Nâng Cấp', avoid: 'Đại Nhảy Vọt' }])
    db.close()
  })

  it('channelGuidance chỉ giữ lại các kênh hợp lệ, bỏ kênh không tồn tại', () => {
    const normalized = normalizeBrandProfile({
      ...DEFAULT_BRAND_PROFILE,
      channelGuidance: { linkedin: 'ok', tiktok: 'không hợp lệ' },
    })
    expect(normalized.channelGuidance.linkedin).toBe('ok')
    expect((normalized.channelGuidance as Record<string, string>).tiktok).toBeUndefined()
  })

  it('input rỗng/thiếu field vẫn chuẩn hoá ra 1 profile hợp lệ, không throw', () => {
    const normalized = normalizeBrandProfile({})
    expect(normalized.brandName).toBe(DEFAULT_BRAND_PROFILE.brandName)
    expect(normalized.writingRules).toEqual([])
    expect(normalized.channelGuidance).toEqual({})
  })

  it('input rác (không phải object) không làm crash, trả về mặc định', () => {
    expect(() => normalizeBrandProfile('không phải object')).not.toThrow()
    expect(() => normalizeBrandProfile(null)).not.toThrow()
  })
})
