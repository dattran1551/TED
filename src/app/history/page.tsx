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
      <main className="page-shell">
        <p className="alert" role="alert">
          Không tải được lịch sử.{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => location.reload()}>
            Thử lại
          </button>
        </p>
      </main>
    )
  }
  if (!runs) {
    return (
      <main className="page-shell">
        <p className="loading-text">Đang tải...</p>
      </main>
    )
  }
  if (runs.length === 0) {
    return (
      <main className="page-shell">
        <p className="empty-state">
          Chưa có lịch sử, thử tạo nội dung đầu tiên.{' '}
          <Link className="link-accent" href="/">
            Về trang chính
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="hero">
        <h1>Lịch sử</h1>
      </div>
      <div className="history-list">
        {runs.map((run) => (
          <article key={run.id} className="history-card">
            <p className="history-date">{parseSqliteUtc(run.createdAt).toLocaleString('vi-VN')}</p>
            <p className="history-input">{run.inputText}</p>
            <ul className="history-outputs">
              {run.outputs.map((o) => (
                <li key={o.id} data-branch={o.branch}>
                  <span className="history-output-label">{BRANCH_LABELS[o.branch] ?? o.branch}</span>
                  <span className="history-output-text">
                    {o.editedContent ?? o.content ?? `(lỗi: ${o.errorMessage})`}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </main>
  )
}
