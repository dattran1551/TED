import { describe, it, expect } from 'vitest'
import { createDb } from './db'
import { createPackage, getPackage, getVariant, listPackagesByConversation, updateVariant } from './generatedContent'
import { createConversation } from './chat'

describe('Multi-platform generation storage', () => {
  it('tạo 1 gói với nhiều biến thể theo kênh', () => {
    const db = createDb(':memory:')
    const convId = createConversation(db)
    const pkg = createPackage(db, {
      conversationId: convId,
      briefId: null,
      mode: 'package',
      variants: [
        { channel: 'linkedin', title: '', content: 'Nội dung LinkedIn' },
        { channel: 'facebook', title: '', content: 'Nội dung Facebook' },
        { channel: 'internal', title: '', content: 'Nội dung Internal' },
      ],
    })
    expect(pkg.variants).toHaveLength(3)
    expect(pkg.variants.map((v) => v.channel)).toEqual(['linkedin', 'facebook', 'internal'])
    expect(pkg.mode).toBe('package')
    db.close()
  })

  it('regenerate/sửa 1 biến thể KHÔNG ảnh hưởng các biến thể khác trong cùng gói (yêu cầu 5.3)', () => {
    const db = createDb(':memory:')
    const pkg = createPackage(db, {
      conversationId: null,
      briefId: null,
      mode: 'package',
      variants: [
        { channel: 'linkedin', title: '', content: 'Bản gốc LinkedIn' },
        { channel: 'facebook', title: '', content: 'Bản gốc Facebook' },
      ],
    })
    const linkedinVariant = pkg.variants.find((v) => v.channel === 'linkedin')!
    updateVariant(db, linkedinVariant.id, { content: 'Bản mới LinkedIn', status: 'generated' })

    const updated = getPackage(db, pkg.id)!
    expect(updated.variants.find((v) => v.channel === 'linkedin')?.content).toBe('Bản mới LinkedIn')
    expect(updated.variants.find((v) => v.channel === 'facebook')?.content).toBe('Bản gốc Facebook')
    db.close()
  })

  it('liệt kê đúng các gói nội dung thuộc 1 cuộc hội thoại', () => {
    const db = createDb(':memory:')
    const convId = createConversation(db)
    const otherConvId = createConversation(db)
    createPackage(db, { conversationId: convId, briefId: null, mode: 'single', variants: [{ channel: 'email', title: '', content: 'a' }] })
    createPackage(db, { conversationId: otherConvId, briefId: null, mode: 'single', variants: [{ channel: 'email', title: '', content: 'b' }] })

    const packages = listPackagesByConversation(db, convId)
    expect(packages).toHaveLength(1)
    expect(packages[0].variants[0].content).toBe('a')
    db.close()
  })

  it('getVariant/getPackage trả undefined khi id không tồn tại', () => {
    const db = createDb(':memory:')
    expect(getVariant(db, 999)).toBeUndefined()
    expect(getPackage(db, 999)).toBeUndefined()
    db.close()
  })
})
