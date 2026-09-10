'use client'

import { useState, useEffect } from 'react'
import { BRANCH_LABELS } from '@/types'
import type { RunOutput } from '@/types'

export function ResultCard({
  output,
  onRegenerate,
  onSaveEdit,
}: {
  output: RunOutput
  onRegenerate: (note: string) => void
  onSaveEdit: (text: string) => void
}) {
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState(output.editedContent ?? output.content ?? '')

  useEffect(() => {
    if (!editing) {
      setEditedText(output.editedContent ?? output.content ?? '')
    }
  }, [output.content, output.editedContent, editing])

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
          <button className="btn btn-ghost" onClick={() => onRegenerate('')}>
            Thử lại
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
          />
          <button className="btn btn-ghost btn-sm" onClick={() => onRegenerate(note)}>
            Ghi chú, tạo lại
          </button>
        </div>
      )}
    </div>
  )
}
