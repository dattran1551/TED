'use client'

import { useEffect, useState } from 'react'
import type { BrandProfile, BrandTermRule } from '@/types'
import { CHANNELS, labelOf } from '@/lib/config'

const EMPTY_PROFILE: BrandProfile = {
  brandName: '',
  brandDescription: '',
  voice: '',
  tones: [],
  writingRules: [],
  preferredTerms: [],
  avoidedTerms: [],
  ctaGuidance: '',
  hashtagGuidance: '',
  channelGuidance: {},
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

// Feature #2 — Brand Brain: trang cấu hình đơn giản, sửa xong lưu ngay vào
// CSDL, các lần TED viết nội dung sau đó tự dùng bản mới — không cần sửa code
// hay deploy lại (yêu cầu 4.4/4.7).
export default function BrandBrainPage() {
  const [profile, setProfile] = useState<BrandProfile>(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/brand')
      .then((res) => res.json())
      .then((data) => {
        setProfile(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Không tải được cấu hình thương hiệu.')
        setLoading(false)
      })
  }, [])

  function updatePreferredTerm(index: number, patch: Partial<BrandTermRule>) {
    setProfile((prev) => ({
      ...prev,
      preferredTerms: prev.preferredTerms.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }))
  }

  function removePreferredTerm(index: number) {
    setProfile((prev) => ({ ...prev, preferredTerms: prev.preferredTerms.filter((_, i) => i !== index) }))
  }

  function addPreferredTerm() {
    setProfile((prev) => ({ ...prev, preferredTerms: [...prev.preferredTerms, { preferred: '', avoid: '' }] }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (!res.ok) {
        setError('Không lưu được, thử lại nhé.')
        return
      }
      setProfile(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Không gửi được, kiểm tra kết nối rồi thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <p>Đang tải...</p>
      </main>
    )
  }

  return (
    <main className="page-shell brand-page">
      <h1>Brand Brain</h1>
      <p className="brand-intro">
        Cấu hình cách TED viết nội dung theo đúng giọng thương hiệu. Sửa xong bấm Lưu — mọi nội dung TED tạo sau đó áp
        dụng ngay bản mới.
      </p>

      <div className="brand-form">
        <div className="brand-field">
          <label className="composer-label">Tên thương hiệu</label>
          <input className="input" value={profile.brandName} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })} />
        </div>

        <div className="brand-field">
          <label className="composer-label">Mô tả thương hiệu</label>
          <textarea
            className="input composer-textarea"
            value={profile.brandDescription}
            onChange={(e) => setProfile({ ...profile, brandDescription: e.target.value })}
          />
        </div>

        <div className="brand-field">
          <label className="composer-label">Giọng thương hiệu (voice)</label>
          <textarea className="input composer-textarea" value={profile.voice} onChange={(e) => setProfile({ ...profile, voice: e.target.value })} />
        </div>

        <div className="brand-field">
          <label className="composer-label">Tông giọng ưu tiên (mỗi dòng 1 tông)</label>
          <textarea
            className="input composer-textarea-sm"
            value={profile.tones.join('\n')}
            onChange={(e) => setProfile({ ...profile, tones: linesToList(e.target.value) })}
          />
        </div>

        <div className="brand-field">
          <label className="composer-label">Quy tắc viết (mỗi dòng 1 quy tắc)</label>
          <textarea
            className="input composer-textarea"
            value={profile.writingRules.join('\n')}
            onChange={(e) => setProfile({ ...profile, writingRules: linesToList(e.target.value) })}
          />
        </div>

        <div className="brand-field">
          <label className="composer-label">Từ ngữ ưu tiên / nên tránh</label>
          {profile.preferredTerms.map((term, index) => (
            <div key={index} className="brand-term-row">
              <input
                className="input"
                placeholder="Dùng từ này"
                value={term.preferred}
                onChange={(e) => updatePreferredTerm(index, { preferred: e.target.value })}
              />
              <input
                className="input"
                placeholder="Thay vì từ này (không bắt buộc)"
                value={term.avoid ?? ''}
                onChange={(e) => updatePreferredTerm(index, { avoid: e.target.value })}
              />
              <button className="btn btn-ghost btn-sm" onClick={() => removePreferredTerm(index)}>
                Xoá
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={addPreferredTerm}>
            + Thêm cặp từ
          </button>
        </div>

        <div className="brand-field">
          <label className="composer-label">Từ/cụm cần tránh (mỗi dòng 1 từ)</label>
          <textarea
            className="input composer-textarea-sm"
            value={profile.avoidedTerms.join('\n')}
            onChange={(e) => setProfile({ ...profile, avoidedTerms: linesToList(e.target.value) })}
          />
        </div>

        <div className="brand-field">
          <label className="composer-label">Hướng dẫn CTA</label>
          <textarea className="input composer-textarea-sm" value={profile.ctaGuidance} onChange={(e) => setProfile({ ...profile, ctaGuidance: e.target.value })} />
        </div>

        <div className="brand-field">
          <label className="composer-label">Hướng dẫn hashtag</label>
          <textarea
            className="input composer-textarea-sm"
            value={profile.hashtagGuidance}
            onChange={(e) => setProfile({ ...profile, hashtagGuidance: e.target.value })}
          />
        </div>

        <div className="brand-field">
          <label className="composer-label">Hướng dẫn riêng theo kênh</label>
          {CHANNELS.filter((c) => c.id !== 'other').map((channel) => (
            <div key={channel.id} className="brand-channel-row">
              <span className="brand-channel-label">{labelOf(CHANNELS, channel.id)}</span>
              <textarea
                className="input composer-textarea-sm"
                value={profile.channelGuidance[channel.id] ?? ''}
                onChange={(e) =>
                  setProfile({ ...profile, channelGuidance: { ...profile.channelGuidance, [channel.id]: e.target.value } })
                }
              />
            </div>
          ))}
        </div>

        {error && <p className="variant-error">{error}</p>}

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu...' : saved ? 'Đã lưu ✓' : 'Lưu'}
        </button>
      </div>
    </main>
  )
}
