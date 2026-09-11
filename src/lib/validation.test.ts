import { describe, it, expect } from 'vitest'
import { countWords, validateInput, MAX_WORDS } from './validation'

describe('countWords', () => {
  it('đếm đúng số từ cách nhau bởi khoảng trắng', () => {
    expect(countWords('một hai ba')).toBe(3)
  })

  it('trả về 0 với chuỗi rỗng hoặc toàn khoảng trắng', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
  })
})

describe('validateInput', () => {
  it('báo empty khi chưa nhập gì', () => {
    const result = validateInput('', { tones: ['hai'] })
    expect(result).toEqual({ valid: false, reason: 'empty' })
  })

  it('báo too_long khi vượt quá MAX_WORDS', () => {
    const longText = new Array(MAX_WORDS + 1).fill('từ').join(' ')
    const result = validateInput(longText, { tones: ['hai'] })
    expect(result).toEqual({ valid: false, reason: 'too_long' })
  })

  it('báo no_options khi không chọn giọng văn nào', () => {
    const result = validateInput('nội dung mẫu', { tones: [] })
    expect(result).toEqual({ valid: false, reason: 'no_options' })
  })

  it('hợp lệ khi có text và ít nhất 1 giọng văn', () => {
    expect(validateInput('nội dung mẫu', { tones: ['hai'] })).toEqual({ valid: true })
  })
})
