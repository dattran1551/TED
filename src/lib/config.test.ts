import { describe, it, expect } from 'vitest'
import {
  CHANNELS,
  CONTENT_TYPES,
  LENGTHS,
  QUALITY_CRITERIA,
  TONES,
  TRANSFORM_ACTIONS,
  isChannelId,
  isContentTypeId,
  isLengthId,
  isToneId,
  isTransformActionId,
  labelOf,
} from './config'

function expectUniqueIds(list: readonly { id: string }[]) {
  const ids = list.map((i) => i.id)
  expect(new Set(ids).size).toBe(ids.length)
}

describe('config', () => {
  it('mọi danh sách cấu hình có id duy nhất, không trùng lặp', () => {
    expectUniqueIds(CONTENT_TYPES)
    expectUniqueIds(CHANNELS)
    expectUniqueIds(TONES)
    expectUniqueIds(LENGTHS)
    expectUniqueIds(TRANSFORM_ACTIONS)
    expectUniqueIds(QUALITY_CRITERIA)
  })

  it('type guard nhận id hợp lệ, từ chối id không tồn tại', () => {
    expect(isContentTypeId('social_post')).toBe(true)
    expect(isContentTypeId('khong_ton_tai')).toBe(false)
    expect(isChannelId('linkedin')).toBe(true)
    expect(isChannelId('tiktok')).toBe(false)
    expect(isToneId('professional')).toBe(true)
    expect(isToneId('abc')).toBe(false)
    expect(isLengthId('medium')).toBe(true)
    expect(isLengthId('huge')).toBe(false)
    expect(isTransformActionId('rewrite')).toBe(true)
    expect(isTransformActionId('delete')).toBe(false)
  })

  it('labelOf trả về label tương ứng, hoặc chính id nếu không tìm thấy', () => {
    expect(labelOf(CHANNELS, 'linkedin')).toBe('LinkedIn')
    expect(labelOf(CHANNELS, 'unknown')).toBe('unknown')
  })
})
