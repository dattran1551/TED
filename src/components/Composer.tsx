'use client'

import { useState } from 'react'
import { CHANNELS, CONTENT_TYPES, LENGTHS, TONES, type ChannelId, type ContentTypeId, type LengthId, type ToneId } from '@/lib/config'

export interface ComposerSubmitValue {
  contentType: ContentTypeId
  channels: ChannelId[]
  tones: ToneId[]
  length: LengthId
  audience: string
  keyMessages: string
  cta: string
  additionalContext: string
}

interface ComposerProps {
  initialContentType?: ContentTypeId
  submitting: boolean
  onSubmit: (value: ComposerSubmitValue) => void
  onClose: () => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

// Feature #1 — Structured Brief / Smart Composer. Bổ trợ cho chat tự do (3.7):
// không field nào bắt buộc ngoài loại nội dung + ít nhất 1 kênh, phần còn lại
// TED tự suy luận khi viết nếu bỏ trống.
export function Composer({ initialContentType, submitting, onSubmit, onClose }: ComposerProps) {
  const [contentType, setContentType] = useState<ContentTypeId>(initialContentType ?? 'social_post')
  const [channels, setChannels] = useState<ChannelId[]>(['linkedin'])
  const [tones, setTones] = useState<ToneId[]>([])
  const [length, setLength] = useState<LengthId>('medium')
  const [audience, setAudience] = useState('')
  const [keyMessages, setKeyMessages] = useState('')
  const [cta, setCta] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')

  function handleSubmit() {
    if (channels.length === 0 || submitting) return
    onSubmit({ contentType, channels, tones, length, audience, keyMessages, cta, additionalContext })
  }

  return (
    <div className="composer">
      <div className="composer-header">
        <h3>Tạo theo Brief</h3>
        <button className="composer-close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </div>

      <div className="composer-field">
        <label className="composer-label">Bạn đang tạo gì?</label>
        <select className="input" value={contentType} onChange={(e) => setContentType(e.target.value as ContentTypeId)}>
          {CONTENT_TYPES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="composer-field">
        <label className="composer-label">Kênh (chọn từ 2 kênh trở lên để tạo cả gói nội dung)</label>
        <div className="chip-row">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={channels.includes(c.id) ? 'chip is-selected' : 'chip'}
              onClick={() => setChannels((prev) => toggle(prev, c.id))}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="composer-field">
        <label className="composer-label">Giọng văn</label>
        <div className="chip-row">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tones.includes(t.id) ? 'chip is-selected' : 'chip'}
              onClick={() => setTones((prev) => toggle(prev, t.id))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="composer-field">
        <label className="composer-label">Độ dài</label>
        <div className="chip-row">
          {LENGTHS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={length === l.id ? 'chip is-selected' : 'chip'}
              onClick={() => setLength(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="composer-field">
        <label className="composer-label">Đối tượng đọc (không bắt buộc)</label>
        <input className="input" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ví dụ: khách hàng, nội bộ công ty, cộng đồng game thủ..." />
      </div>

      <div className="composer-field">
        <label className="composer-label">Thông điệp chính</label>
        <textarea
          className="input composer-textarea"
          value={keyMessages}
          onChange={(e) => setKeyMessages(e.target.value)}
          placeholder="Nội dung/thông tin cốt lõi cần truyền tải"
        />
      </div>

      <div className="composer-field">
        <label className="composer-label">CTA (không bắt buộc)</label>
        <textarea className="input composer-textarea-sm" value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Hành động mong muốn người đọc thực hiện" />
      </div>

      <div className="composer-field">
        <label className="composer-label">Bối cảnh thêm (không bắt buộc)</label>
        <textarea
          className="input composer-textarea"
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Bất kỳ thông tin nào khác — càng chi tiết TED viết càng sát ý bạn"
        />
      </div>

      <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || channels.length === 0}>
        {submitting ? 'TED đang tạo nội dung...' : 'Tạo với TED'}
      </button>
    </div>
  )
}
