'use client'

import { useEffect, useState } from 'react'
import { MAX_WORDS, countWords, validateInput } from '@/lib/validation'
import { ResultCard } from '@/components/ResultCard'
import { BRANCH_LABELS } from '@/types'
import type { Run, RunOutput, GenerateOptions, Tone, TranslateTarget } from '@/types'

const TONE_LABELS: Record<Tone, string> = {
  chuyen_nghiep: BRANCH_LABELS.chuyen_nghiep,
  re_trung: BRANCH_LABELS.re_trung,
  hai: BRANCH_LABELS.hai,
}

// Khoảng cách giữa hai lần hỏi lại máy chủ xem nhánh nào đã xong.
const POLL_INTERVAL_MS = 1500

function hasPending(run: Run): boolean {
  return run.outputs.some((o) => o.status === 'pending')
}

export default function HomePage() {
  const [inputText, setInputText] = useState('')
  const [tones, setTones] = useState<Set<Tone>>(new Set())
  const [run, setRun] = useState<Run | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pollRunId, setPollRunId] = useState<number | null>(null)

  // Hỏi lại máy chủ đều đặn chừng nào còn nhánh đang chạy, để mỗi thẻ tự hiện
  // kết quả ngay khi nhánh của nó xong, không phải đợi nhánh chậm nhất.
  useEffect(() => {
    if (pollRunId === null) return
    let cancelled = false

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${pollRunId}`)
        if (!res.ok) throw new Error('poll_error')
        const fresh: Run = await res.json()
        if (cancelled) return
        setRun(fresh)
        if (!hasPending(fresh)) setPollRunId(null)
      } catch {
        // Lần POST ban đầu đã thành công rồi, nên nếu giờ không hỏi lại được
        // thì chỉ im lặng dừng, không quay vòng mãi trên một kết nối hỏng.
        if (!cancelled) setPollRunId(null)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pollRunId])

  const wordCount = countWords(inputText)
  const options: GenerateOptions = { tones: Array.from(tones) }
  const validation = validateInput(inputText, options)

  function toggleTone(tone: Tone) {
    setTones((prev) => {
      const next = new Set(prev)
      if (next.has(tone)) next.delete(tone)
      else next.add(tone)
      return next
    })
  }

  async function handleSubmit() {
    if (!validation.valid) {
      setBlockedReason(validation.reason ?? null)
      return
    }
    setBlockedReason(null)
    setActionError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText, options }),
      })
      if (!res.ok) throw new Error('server_error')
      const data: Run = await res.json()
      // Máy chủ trả về ngay, mọi nhánh còn 'pending' — các thẻ hiện "Đang
      // tạo..." rồi lần lượt sáng lên khi nhánh của mình xong.
      setRun(data)
      setPollRunId(hasPending(data) ? data.id : null)
    } catch {
      setActionError('Không gọi được AI, thử lại sau.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegenerate(output: RunOutput, note: string) {
    if (!run) return
    setActionError(null)
    try {
      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.id, outputId: output.id, note }),
      })
      if (!res.ok) throw new Error('server_error')
      const data = await res.json()
      setRun(data)
    } catch {
      setActionError('Không tạo lại được, thử lại sau.')
    }
  }

  async function handleTranslate(sourceOutput: RunOutput, targetBranch: TranslateTarget) {
    if (!run) return
    setActionError(null)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.id, sourceOutputId: sourceOutput.id, targetBranch }),
      })
      if (!res.ok) throw new Error('server_error')
      const data: Run = await res.json()
      setRun(data)
    } catch {
      setActionError('Không dịch được, thử lại sau.')
    }
  }

  async function handleSaveEdit(output: RunOutput, editedContent: string) {
    if (!run) return
    setActionError(null)
    try {
      const res = await fetch('/api/edit-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId: output.id, editedContent }),
      })
      if (!res.ok) throw new Error('server_error')
      setRun((prev) =>
        prev
          ? {
              ...prev,
              outputs: prev.outputs.map((o) => (o.id === output.id ? { ...o, editedContent } : o)),
            }
          : prev
      )
    } catch {
      setActionError('Không lưu được bản sửa, thử lại sau.')
    }
  }

  return (
    <main className="page-shell">
      <div className="hero">
        <h1>Trợ lý viết nội dung</h1>
      </div>

      <div className="composer">
        <textarea
          className="input textarea-main"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Dán yêu cầu của bạn vào đây..."
        />
        <p className="word-count">
          {wordCount} / {MAX_WORDS} từ
        </p>

        <fieldset className="tone-picker">
          <legend>Giọng văn</legend>
          <div className="tone-picker-options">
            {(Object.keys(TONE_LABELS) as Tone[]).map((tone) => (
              <label key={tone} className="tone-chip" data-tone={tone} data-checked={tones.has(tone)}>
                <input type="checkbox" checked={tones.has(tone)} onChange={() => toggleTone(tone)} />
                {TONE_LABELS[tone]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="composer-messages">
          {blockedReason === 'no_options' && (
            <p className="alert" role="alert">Chọn ít nhất 1 giọng văn nhé.</p>
          )}
          {blockedReason === 'too_long' && (
            <p className="alert" role="alert">Đoạn nhập vượt quá {MAX_WORDS} từ.</p>
          )}
          {blockedReason === 'empty' && <p className="alert" role="alert">Nhập nội dung trước đã.</p>}
          {actionError && <p className="alert" role="alert">{actionError}</p>}
        </div>

        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Đang tạo...' : 'Tạo nội dung'}
        </button>
      </div>

      {run && (
        <section className="results-grid">
          {run.outputs.map((output) => (
            <ResultCard
              key={output.id}
              output={output}
              onRegenerate={(note) => handleRegenerate(output, note)}
              onSaveEdit={(text) => handleSaveEdit(output, text)}
              onTranslate={(target) => handleTranslate(output, target)}
            />
          ))}
        </section>
      )}
    </main>
  )
}
