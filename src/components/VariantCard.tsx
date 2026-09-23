'use client'

import { useState } from 'react'
import { QUALITY_CRITERIA, TRANSFORM_ACTIONS, labelOf, type TransformActionId } from '@/lib/config'
import type { ContentVariant, GeneratedContent, QualityCheckResult } from '@/types'

interface VariantCardProps {
  variant: ContentVariant
  onUpdated: (pkg: GeneratedContent) => void
}

const HIGH_VALUE_ACTIONS: TransformActionId[] = ['shorten', 'improve_hook']
const SECONDARY_ACTIONS: TransformActionId[] = TRANSFORM_ACTIONS.map((a) => a.id).filter(
  (id) => !HIGH_VALUE_ACTIONS.includes(id)
)

const QUALITY_ICON: Record<QualityCheckResult['checks'][number]['status'], string> = {
  pass: '✓',
  warning: '⚠',
  fail: '✕',
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

// Feature #4 — 1 thẻ nội dung: sửa tay, các Quick Action (kiến trúc command-
// driven, dùng chung 1 endpoint /transform), và Feature #5 TED Check ngay
// trong cùng thẻ để không phải rời khỏi khung làm việc (7.5).
export function VariantCard({ variant, onUpdated }: VariantCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(variant.content)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [translateTarget, setTranslateTarget] = useState('English')
  const [showTranslateInput, setShowTranslateInput] = useState(false)
  const [alternatives, setAlternatives] = useState<string[] | null>(null)
  const [qualityCheck, setQualityCheck] = useState<QualityCheckResult | null>(null)
  const [checkingQuality, setCheckingQuality] = useState(false)

  function startEdit() {
    setDraft(variant.content)
    setIsEditing(true)
  }

  async function saveEdit() {
    const content = draft.trim()
    if (!content) return
    setBusy('save')
    setError(null)
    const res = await fetch(`/api/content/variant/${variant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title: variant.title }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      setError(data.message ?? 'Không lưu được, thử lại nhé.')
      return
    }
    setIsEditing(false)
    setQualityCheck(null)
    onUpdated(data.package)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(variant.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Không copy được, thử chọn văn bản thủ công.')
    }
  }

  async function handleRegenerate() {
    setBusy('regenerate')
    setError(null)
    setQualityCheck(null)
    const { ok, data } = await postJson(`/api/content/variant/${variant.id}/regenerate`, {})
    setBusy(null)
    if (!ok) {
      setError(data.message ?? 'Không tạo lại được, thử lại nhé.')
      return
    }
    onUpdated(data.package)
  }

  async function handleTransform(action: TransformActionId, targetLanguage?: string) {
    setBusy(action)
    setError(null)
    const { ok, data } = await postJson(`/api/content/variant/${variant.id}/transform`, { action, targetLanguage })
    setBusy(null)
    if (!ok) {
      setError(data.message ?? 'TED không xử lý được yêu cầu này, thử lại nhé.')
      return
    }
    if (action === 'alternatives') {
      setAlternatives(data.alternatives)
    } else {
      setQualityCheck(null)
      onUpdated(data.package)
    }
  }

  async function applyAlternative(text: string) {
    setDraft(text)
    setAlternatives(null)
    setIsEditing(true)
  }

  async function runQualityCheck() {
    setCheckingQuality(true)
    setError(null)
    const { ok, data } = await postJson(`/api/content/variant/${variant.id}/quality-check`, { action: 'run' })
    setCheckingQuality(false)
    if (!ok) {
      setError(data.message ?? 'Không kiểm tra được, thử lại nhé.')
      return
    }
    setQualityCheck(data.qualityCheck)
  }

  async function fixWithTed() {
    setBusy('fix')
    setError(null)
    const { ok, data } = await postJson(`/api/content/variant/${variant.id}/quality-check`, { action: 'fix' })
    setBusy(null)
    if (!ok) {
      setError(data.message ?? 'Không sửa được, thử lại nhé.')
      return
    }
    setQualityCheck(null)
    onUpdated(data.package)
  }

  const isBusy = busy !== null

  return (
    <div className="variant-card">
      {variant.title && <div className="variant-card-title">{variant.title}</div>}

      {isEditing ? (
        <textarea className="input variant-editor" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} />
      ) : (
        <div className="variant-card-content">{variant.content}</div>
      )}

      <div className="variant-actions">
        {isEditing ? (
          <>
            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={isBusy}>
              Lưu
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)} disabled={isBusy}>
              Huỷ
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
              {copied ? 'Đã copy ✓' : 'Copy'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={startEdit} disabled={isBusy}>
              Sửa
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleRegenerate} disabled={isBusy}>
              {busy === 'regenerate' ? 'Đang tạo lại...' : 'Tạo lại'}
            </button>
            {HIGH_VALUE_ACTIONS.map((action) => (
              <button key={action} className="btn btn-ghost btn-sm" onClick={() => handleTransform(action)} disabled={isBusy}>
                {busy === action ? '...' : labelOf(TRANSFORM_ACTIONS, action)}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowMore((v) => !v)} disabled={isBusy}>
              Thao tác khác
            </button>
          </>
        )}
      </div>

      {showMore && !isEditing && (
        <div className="variant-more-actions">
          {SECONDARY_ACTIONS.map((action) =>
            action === 'translate' ? (
              <button
                key={action}
                className="chip"
                onClick={() => setShowTranslateInput((v) => !v)}
                disabled={isBusy}
              >
                {labelOf(TRANSFORM_ACTIONS, action)}
              </button>
            ) : (
              <button key={action} className="chip" onClick={() => handleTransform(action)} disabled={isBusy}>
                {busy === action ? '...' : labelOf(TRANSFORM_ACTIONS, action)}
              </button>
            )
          )}
          {showTranslateInput && (
            <div className="variant-translate-row">
              <input
                className="input"
                value={translateTarget}
                onChange={(e) => setTranslateTarget(e.target.value)}
                placeholder="Ngôn ngữ đích, ví dụ: English"
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={isBusy || !translateTarget.trim()}
                onClick={() => handleTransform('translate', translateTarget.trim())}
              >
                Dịch
              </button>
            </div>
          )}
        </div>
      )}

      {alternatives && (
        <div className="variant-alternatives">
          <p className="variant-alternatives-label">Các phiên bản khác — chọn 1 bản để đưa vào ô sửa:</p>
          {alternatives.map((alt, idx) => (
            <div key={idx} className="variant-alternative-item">
              <p>{alt}</p>
              <button className="btn btn-ghost btn-sm" onClick={() => applyAlternative(alt)}>
                Dùng bản này
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setAlternatives(null)}>
            Đóng
          </button>
        </div>
      )}

      {error && <p className="variant-error">{error}</p>}

      <div className="quality-check">
        {!qualityCheck ? (
          <button className="btn btn-ghost btn-sm" onClick={runQualityCheck} disabled={checkingQuality}>
            {checkingQuality ? 'TED đang kiểm tra...' : 'TED Check'}
          </button>
        ) : (
          <div className="quality-check-panel">
            <ul className="quality-check-list">
              {qualityCheck.checks.map((check) => (
                <li key={check.criterion} className={`quality-check-item is-${check.status}`}>
                  <span className="quality-check-icon">{QUALITY_ICON[check.status]}</span>
                  <span>{labelOf(QUALITY_CRITERIA, check.criterion)}</span>
                  {check.status !== 'pass' && <span className="quality-check-feedback">— {check.feedback}</span>}
                </li>
              ))}
            </ul>
            {qualityCheck.autoFixAvailable && (
              <button className="btn btn-primary btn-sm" onClick={fixWithTed} disabled={isBusy}>
                {busy === 'fix' ? 'TED đang sửa...' : 'Fix with TED'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={runQualityCheck} disabled={checkingQuality}>
              Check lại
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
