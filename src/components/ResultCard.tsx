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
    <div>
      <h3>{BRANCH_LABELS[output.branch] ?? output.branch}</h3>

      {output.status === 'pending' && <p>Đang tạo...</p>}

      {output.status === 'error' && (
        <div role="alert">
          <p>Không tạo được bản này: {output.errorMessage ?? 'Lỗi không rõ.'}</p>
          <button onClick={() => onRegenerate('')}>Thử lại</button>
        </div>
      )}

      {output.status === 'success' && !editing && (
        <>
          <p>{output.editedContent ?? output.content}</p>
          <button onClick={() => setEditing(true)}>Sửa tay</button>
        </>
      )}

      {output.status === 'success' && editing && (
        <>
          <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} />
          <button
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
        <div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú điều chỉnh (vd: hài hơn, ngắn câu lại)"
          />
          <button onClick={() => onRegenerate(note)}>Ghi chú, tạo lại</button>
        </div>
      )}
    </div>
  )
}
