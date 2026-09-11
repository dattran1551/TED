'use client'

import { useState, useEffect } from 'react'
import { BRANCH_LABELS } from '@/types'
import type { RunOutput, TranslateTarget } from '@/types'

// Chỉ các bản giọng văn (không phải bản dịch) mới cho phép chọn để dịch tiếp —
// tránh việc dịch một bản dịch, gây lẫn lộn nguồn gốc nội dung.
const TONE_BRANCHES = new Set(['chuyen_nghiep', 're_trung', 'hai'])

export function ResultCard({
  output,
  onRegenerate,
  onSaveEdit,
  onTranslate,
}: {
  output: RunOutput
  onRegenerate: (note: string) => Promise<void>
  onSaveEdit: (text: string) => void
  onTranslate: (targetBranch: TranslateTarget) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState(output.editedContent ?? output.content ?? '')
  const [chosen, setChosen] = useState(false)
  // AI trả lời có lúc mất tới cả phút — không có 2 dòng trạng thái này thì
  // nút bấm xong đứng yên, trông y hệt như bị hỏng.
  const [regenerating, setRegenerating] = useState(false)
  const [translatingTarget, setTranslatingTarget] = useState<TranslateTarget | null>(null)

  useEffect(() => {
    if (!editing) {
      setEditedText(output.editedContent ?? output.content ?? '')
    }
  }, [output.content, output.editedContent, editing])

  const canTranslate = TONE_BRANCHES.has(output.branch)

  async function handleRegenerateClick(noteToSend: string) {
    setRegenerating(true)
    try {
      await onRegenerate(noteToSend)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleTranslateClick(target: TranslateTarget) {
    setTranslatingTarget(target)
    try {
      await onTranslate(target)
    } finally {
      setTranslatingTarget(null)
    }
  }

  return (
    <div className="result-card" data-branch={output.branch}>
      <div className="result-card-head">
        <span className="result-card-dot" aria-hidden="true" />
        <h3 className="result-card-title">{BRANCH_LABELS[output.branch] ?? output.branch}</h3>
      </div>

      {output.status === 'pending' && <p className="result-card-pending">Đang tạo...</p>}

      {output.status === 'error' && (
        <div className="result-card-error" role="alert">
          <p>Không tạo được bản này: {output.errorMessage ?? 'Lỗi không rõ.'}</p>
          <button
            className="btn btn-ghost"
            onClick={() => handleRegenerateClick('')}
            disabled={regenerating}
          >
            {regenerating ? 'Đang thử lại...' : 'Thử lại'}
          </button>
        </div>
      )}

      {output.status === 'success' && !editing && (
        <>
          <p className="result-card-text">{output.editedContent ?? output.content}</p>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Sửa tay
          </button>
        </>
      )}

      {output.status === 'success' && editing && (
        <>
          <textarea
            className="result-card-edit"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              onSaveEdit(editedText)
              setEditing(false)
            }}
          >
            Lưu
          </button>
        </>
      )}

      {output.status === 'success' && (
        <div className="result-card-note">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú điều chỉnh (vd: hài hơn, ngắn câu lại)"
            disabled={regenerating}
          />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => handleRegenerateClick(note)}
            disabled={regenerating}
          >
            {regenerating ? 'Đang tạo lại...' : 'Ghi chú, tạo lại'}
          </button>
        </div>
      )}

      {output.status === 'success' && canTranslate && !chosen && (
        <button className="btn btn-ghost btn-sm" onClick={() => setChosen(true)}>
          Chọn bản này
        </button>
      )}

      {output.status === 'success' && canTranslate && chosen && (
        <div className="result-card-translate">
          <button
            className="btn btn-sm translate-btn"
            data-target="dich_anh"
            onClick={() => handleTranslateClick('dich_anh')}
            disabled={translatingTarget !== null}
          >
            {translatingTarget === 'dich_anh' ? 'Đang dịch...' : 'Dịch sang Tiếng Anh'}
          </button>
          <button
            className="btn btn-sm translate-btn"
            data-target="dich_hoa"
            onClick={() => handleTranslateClick('dich_hoa')}
            disabled={translatingTarget !== null}
          >
            {translatingTarget === 'dich_hoa' ? 'Đang dịch...' : 'Dịch sang Tiếng Hoa'}
          </button>
        </div>
      )}
    </div>
  )
}
