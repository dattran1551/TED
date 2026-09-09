'use client'

import { useState } from 'react'
import type { RunOutput } from '@/types'

const BRANCH_LABELS: Record<string, string> = {
  chuyen_nghiep: 'Chuyên nghiệp',
  re_trung: 'Trẻ trung',
  hai: 'Hài',
  viet_anh: 'Việt ↔ Anh',
}

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

  return (
    <div className="result-card">
      <h3>{BRANCH_LABELS[output.branch] ?? output.branch}</h3>

      {output.status === 'pending' && <p>Đang tạo...</p>}

      {output.status === 'error' && (
        <div role="alert">
          <p>Không tạo được bản này: {output.errorMessage}</p>
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
