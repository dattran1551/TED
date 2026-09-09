'use client'

import { useEffect, useState } from 'react'
import type { Run } from '@/types'

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
        Chưa có lịch sử, thử tạo nội dung đầu tiên. <a href="/">Về trang chính</a>
      </p>
    )
  }

  return (
    <main>
      <h1>Lịch sử</h1>
      {runs.map((run) => (
        <article key={run.id}>
          <p>
            <strong>{new Date(run.createdAt).toLocaleString('vi-VN')}</strong>
          </p>
          <p>{run.inputText}</p>
          <ul>
            {run.outputs.map((o) => (
              <li key={o.id}>
                {o.branch}: {o.editedContent ?? o.content ?? `(lỗi: ${o.errorMessage})`}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </main>
  )
}
