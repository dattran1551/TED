'use client'

import { useEffect, useState } from 'react'
import { BRANCH_LABELS } from '@/types'
import type { Branch, GlossaryRule } from '@/types'

export default function GlossaryPage() {
  const [rules, setRules] = useState<GlossaryRule[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    fetch('/api/glossary')
      .then((res) => {
        if (!res.ok) throw new Error('load_error')
        return res.json()
      })
      .then(setRules)
      .catch(() => setLoadError(true))
  }, [])

  function updateRule(branch: Branch, field: keyof GlossaryRule, value: string) {
    setJustSaved(false)
    setRules((prev) => prev?.map((r) => (r.branch === branch ? { ...r, [field]: value } : r)) ?? null)
  }

  async function handleSave() {
    if (!rules) return
    const nextErrors: Record<string, boolean> = {}
    for (const rule of rules) {
      if (!rule.xungHo || !rule.tuVungUuTien || !rule.nhipCau) nextErrors[rule.branch] = true
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setSaveError(false)
    setJustSaved(false)
    try {
      const res = await fetch('/api/glossary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      })
      if (!res.ok) throw new Error('server_error')
      // Route PUT trả về bảng thuật ngữ vừa lưu — dùng luôn nó làm nguồn sự
      // thật, để màn hình khớp đúng với cái đang nằm trong CSDL.
      const saved: GlossaryRule[] = await res.json()
      setRules(saved)
      setJustSaved(true)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <main className="page-shell">
        <p className="alert" role="alert">
          Không tải được bảng thuật ngữ.{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => location.reload()}>
            Thử lại
          </button>
        </p>
      </main>
    )
  }
  if (!rules) {
    return (
      <main className="page-shell">
        <p className="loading-text">Đang tải...</p>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="hero">
        <h1>Bảng thuật ngữ</h1>
      </div>
      <div className="glossary-grid">
        {rules.map((rule) => (
          <fieldset key={rule.branch} className="glossary-card" data-branch={rule.branch}>
            <legend>{BRANCH_LABELS[rule.branch] ?? rule.branch}</legend>
            {errors[rule.branch] && (
              <p className="alert" role="alert">
                Thiếu thông tin bắt buộc cho mục này.
              </p>
            )}
            <label className="field">
              <span className="field-label">Xưng hô</span>
              <input
                className="input"
                value={rule.xungHo}
                onChange={(e) => updateRule(rule.branch, 'xungHo', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Từ vựng ưu tiên</span>
              <input
                className="input"
                value={rule.tuVungUuTien}
                onChange={(e) => updateRule(rule.branch, 'tuVungUuTien', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Từ tránh dùng</span>
              <input
                className="input"
                value={rule.tuTranh}
                onChange={(e) => updateRule(rule.branch, 'tuTranh', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Nhịp câu</span>
              <input
                className="input"
                value={rule.nhipCau}
                onChange={(e) => updateRule(rule.branch, 'nhipCau', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Emoji</span>
              <input
                className="input"
                value={rule.emoji}
                onChange={(e) => updateRule(rule.branch, 'emoji', e.target.value)}
              />
            </label>
          </fieldset>
        ))}
      </div>
      {saveError && (
        <p className="alert" role="alert">
          Không lưu được, thử lại sau.
        </p>
      )}
      {justSaved && !saveError && (
        <p className="status" role="status">
          Đã lưu
        </p>
      )}
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Đang lưu...' : 'Lưu'}
      </button>
    </main>
  )
}
