'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BRANCH_LABELS } from '@/types'
import type { Run } from '@/types'

// SQLite lưu created_at bằng datetime('now'), tức giờ UTC nhưng KHÔNG kèm dấu
// múi giờ (vd "2026-09-09 11:09:51"). Trình duyệt sẽ hiểu chuỗi đó là giờ địa
// phương và hiện lệch đúng bằng chênh lệch múi giờ, nên phải nói rõ đây là UTC.
function parseSqliteUtc(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z')
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    fetch('/api/history')
      .then((res) => {
        if (!res.ok) throw new Error('load_error')
        return res.json()
      })
      .then(setRuns)
      .catch(() => setLoadError(true))
  }, [])

  if (loadError) {
    return (
      <p role="alert">
        Không tải được lịch sử. <button onClick={() => location.reload()}>Thử lại</button>
      </p>
    )
  }
  if (!runs) return <p>Đang tải...</p>
  if (runs.length === 0) {
    return (
      <p>
        Chưa có lịch sử, thử tạo nội dung đầu tiên. <Link href="/">Về trang chính</Link>
      </p>
    )
  }

  return (
    <main>
      <h1>Lịch sử</h1>
      {runs.map((run) => (
        <article key={run.id}>
          <p>
            <strong>{parseSqliteUtc(run.createdAt).toLocaleString('vi-VN')}</strong>
          </p>
          <p>{run.inputText}</p>
          <ul>
            {run.outputs.map((o) => (
              <li key={o.id}>
                {BRANCH_LABELS[o.branch] ?? o.branch}:{' '}
                {o.editedContent ?? o.content ?? `(lỗi: ${o.errorMessage})`}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </main>
  )
}
