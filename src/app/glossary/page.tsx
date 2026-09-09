'use client'

import { useEffect, useState } from 'react'
import type { GlossaryRule } from '@/types'

const BRANCH_LABELS: Record<string, string> = {
  chuyen_nghiep: 'Chuyên nghiệp',
  re_trung: 'Trẻ trung',
  hai: 'Hài',
  viet_anh: 'Việt ↔ Anh',
}

export default function GlossaryPage() {
  const [rules, setRules] = useState<GlossaryRule[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    fetch('/api/glossary')
      .then((res) => {
        if (!res.ok) throw new Error('load_error')
        return res.json()
      })
      .then(setRules)
      .catch(() => setLoadError(true))
  }, [])

  function updateRule(branch: string, field: keyof GlossaryRule, value: string) {
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
    try {
      const res = await fetch('/api/glossary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      })
      if (!res.ok) throw new Error('server_error')
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <p role="alert">
        Không tải được bảng thuật ngữ. <button onClick={() => location.reload()}>Thử lại</button>
      </p>
    )
  }
  if (!rules) return <p>Đang tải...</p>

  return (
    <main>
      <h1>Bảng thuật ngữ</h1>
      {rules.map((rule) => (
        <fieldset key={rule.branch}>
          <legend>{BRANCH_LABELS[rule.branch] ?? rule.branch}</legend>
          {errors[rule.branch] && <p role="alert">Thiếu thông tin bắt buộc cho mục này.</p>}
          <label>
            Xưng hô
            <input value={rule.xungHo} onChange={(e) => updateRule(rule.branch, 'xungHo', e.target.value)} />
          </label>
          <label>
            Từ vựng ưu tiên
            <input
              value={rule.tuVungUuTien}
              onChange={(e) => updateRule(rule.branch, 'tuVungUuTien', e.target.value)}
            />
          </label>
          <label>
            Từ tránh dùng
            <input value={rule.tuTranh} onChange={(e) => updateRule(rule.branch, 'tuTranh', e.target.value)} />
          </label>
          <label>
            Nhịp câu
            <input value={rule.nhipCau} onChange={(e) => updateRule(rule.branch, 'nhipCau', e.target.value)} />
          </label>
          <label>
            Emoji
            <input value={rule.emoji} onChange={(e) => updateRule(rule.branch, 'emoji', e.target.value)} />
          </label>
        </fieldset>
      ))}
      {saveError && <p role="alert">Không lưu được, thử lại sau.</p>}
      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Đang lưu...' : 'Lưu'}
      </button>
    </main>
  )
}
