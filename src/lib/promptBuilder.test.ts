import { describe, it, expect } from 'vitest'
import {
  buildAutoFixMessages,
  buildBrandContextText,
  buildBriefContextText,
  buildGenerationMessages,
  buildQualityCheckMessages,
  buildTransformMessages,
} from './promptBuilder'
import { DEFAULT_BRAND_PROFILE } from './brandDefaults'
import { normalizeBrief } from './briefs'
import type { ContentVariant } from '@/types'

const brief = normalizeBrief({ contentType: 'event_recap', keyMessages: 'Campus tour cùng Arena Multimedia' })

const variant: ContentVariant = {
  id: 1,
  generatedContentId: 1,
  channel: 'linkedin',
  title: 'Tiêu đề cũ',
  content: 'Nội dung LinkedIn hiện tại',
  status: 'generated',
  createdAt: '',
  updatedAt: '',
}

describe('promptBuilder — kiến trúc theo lớp (system + brand + channel + brief)', () => {
  it('buildBrandContextText đưa đúng preferredTerms/avoidedTerms/writingRules vào prompt', () => {
    const text = buildBrandContextText(DEFAULT_BRAND_PROFILE)
    expect(text).toContain('Our Grand Upgrade')
    expect(text).toContain(DEFAULT_BRAND_PROFILE.writingRules[0])
  })

  it('chỉ đưa channelGuidance của ĐÚNG kênh đang xử lý, không lẫn kênh khác', () => {
    const linkedinText = buildBrandContextText(DEFAULT_BRAND_PROFILE, 'linkedin')
    expect(linkedinText).toContain(DEFAULT_BRAND_PROFILE.channelGuidance.linkedin)
    expect(linkedinText).not.toContain(DEFAULT_BRAND_PROFILE.channelGuidance.facebook!)
  })

  it('đổi brand rule thì nội dung prompt đổi theo — không cần sửa code (yêu cầu 4.7)', () => {
    const customBrand = { ...DEFAULT_BRAND_PROFILE, voice: 'Giọng nói đặc biệt để kiểm tra' }
    const text = buildBrandContextText(customBrand)
    expect(text).toContain('Giọng nói đặc biệt để kiểm tra')
  })

  it('buildBriefContextText đưa đủ key messages và loại nội dung', () => {
    const text = buildBriefContextText(brief)
    expect(text).toContain('event_recap')
    expect(text).toContain('Campus tour cùng Arena Multimedia')
  })

  it('buildGenerationMessages yêu cầu đúng các kênh đã chọn và ép JSON output', () => {
    const messages = buildGenerationMessages({ brand: DEFAULT_BRAND_PROFILE, brief, channels: ['linkedin', 'facebook'] })
    const systemText = messages[0].content
    expect(systemText).toContain('linkedin')
    expect(systemText).toContain('facebook')
    expect(systemText).toContain('"outputs"')
  })

  // Regression: GreenNode (và nhiều API tương thích OpenAI) trả HTTP 400 nếu
  // messages chỉ toàn role "system", không có role "user" nào — phát hiện qua
  // kiểm thử tay trên trình duyệt thật, không có test nào bắt được vì mock AI
  // không kiểm tra request thật gửi đi.
  it('mọi prompt tác vụ 1 lượt đều có ít nhất 1 tin nhắn role "user" (GreenNode từ chối request chỉ toàn "system")', () => {
    const generation = buildGenerationMessages({ brand: DEFAULT_BRAND_PROFILE, brief, channels: ['linkedin'] })
    const transform = buildTransformMessages({ action: 'rewrite', brand: DEFAULT_BRAND_PROFILE, brief, variant })
    const qualityCheck = buildQualityCheckMessages({ brand: DEFAULT_BRAND_PROFILE, brief, variant })
    const autoFix = buildAutoFixMessages({ brand: DEFAULT_BRAND_PROFILE, brief, variant, failingFeedback: ['x'] })

    for (const messages of [generation, transform, qualityCheck, autoFix]) {
      expect(messages.some((m) => m.role === 'user')).toBe(true)
    }
  })

  it('buildTransformMessages với action improve_hook chỉ nêu yêu cầu sửa hook, giữ phần còn lại', () => {
    const messages = buildTransformMessages({ action: 'improve_hook', brand: DEFAULT_BRAND_PROFILE, brief, variant })
    expect(messages[0].content).toContain('mở đầu')
    expect(messages[0].content).toContain(variant.content)
  })

  it('buildTransformMessages với action alternatives yêu cầu JSON dạng mảng "alternatives"', () => {
    const messages = buildTransformMessages({ action: 'alternatives', brand: DEFAULT_BRAND_PROFILE, brief, variant })
    expect(messages[0].content).toContain('"alternatives"')
  })

  it('buildTransformMessages với action translate kèm ngôn ngữ đích khi có', () => {
    const messages = buildTransformMessages({
      action: 'translate',
      brand: DEFAULT_BRAND_PROFILE,
      brief,
      variant,
      targetLanguage: 'English',
    })
    expect(messages[0].content).toContain('English')
  })

  it('buildQualityCheckMessages liệt kê đủ các tiêu chí và yêu cầu không cho điểm số', () => {
    const messages = buildQualityCheckMessages({ brand: DEFAULT_BRAND_PROFILE, brief, variant })
    const text = messages[0].content
    for (const criterion of ['brand_voice', 'audience_fit', 'key_message', 'grammar', 'length', 'repetition', 'cta', 'clarity']) {
      expect(text).toContain(criterion)
    }
    expect(text).not.toMatch(/\bscore\b/)
  })

  it('buildAutoFixMessages chỉ yêu cầu sửa đúng các vấn đề được liệt kê', () => {
    const messages = buildAutoFixMessages({
      brand: DEFAULT_BRAND_PROFILE,
      brief,
      variant,
      failingFeedback: ['Thiếu CTA rõ ràng'],
    })
    expect(messages[0].content).toContain('Thiếu CTA rõ ràng')
  })
})
