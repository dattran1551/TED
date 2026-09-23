'use client'

import { useState } from 'react'
import { CHANNELS, labelOf } from '@/lib/config'
import type { GeneratedContent } from '@/types'
import { VariantCard } from './VariantCard'

interface ContentPackageViewProps {
  package: GeneratedContent
  onUpdated: (pkg: GeneratedContent) => void
}

// Feature #3 — 1 gói nội dung hiển thị dạng tab theo kênh khi có từ 2 biến
// thể trở lên; regenerate/sửa 1 tab không ảnh hưởng các tab khác vì mỗi
// VariantCard tự quản lý biến thể của riêng nó.
export function ContentPackageView({ package: pkg, onUpdated }: ContentPackageViewProps) {
  const [activeId, setActiveId] = useState(pkg.variants[0]?.id)
  const activeVariant = pkg.variants.find((v) => v.id === activeId) ?? pkg.variants[0]

  if (!activeVariant) return null

  return (
    <div className="content-package">
      {pkg.variants.length > 1 && (
        <div className="content-package-tabs" role="tablist">
          {pkg.variants.map((v) => (
            <button
              key={v.id}
              role="tab"
              className={v.id === activeVariant.id ? 'content-package-tab is-active' : 'content-package-tab'}
              onClick={() => setActiveId(v.id)}
            >
              {labelOf(CHANNELS, v.channel)}
            </button>
          ))}
        </div>
      )}
      <VariantCard
        key={activeVariant.id}
        variant={activeVariant}
        onUpdated={(updatedPkg) => {
          onUpdated(updatedPkg)
        }}
      />
    </div>
  )
}
