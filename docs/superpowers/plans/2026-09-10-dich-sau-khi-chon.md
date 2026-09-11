# Dịch sau khi chọn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this plan is executed inline by the controlling session, task-by-task, TDD). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ "Cặp Việt ↔ Anh" khỏi panel tuỳ chọn ban đầu; sau khi có kết quả, người dùng bấm "Chọn bản này" trên 1 thẻ giọng văn rồi mới chọn dịch sang Tiếng Anh hoặc Tiếng Hoa (giản thể) — có thể dịch cả hai.

**Architecture:** `Branch` union đổi từ `Tone | 'viet_anh'` thành `Tone | 'dich_anh' | 'dich_hoa'`. Bản dịch là 1 `run_output` MỚI được thêm vào lượt đã có (không phải sinh song song từ đầu), tạo qua route mới `POST /api/translate`, và nhớ nó dịch từ output nào (cột `source_output_id`) để "Ghi chú, tạo lại" dịch lại đúng nguồn thay vì câu nhập gốc.

**Tech Stack:** Next.js App Router, better-sqlite3, Vitest — không đổi so với trước.

**Spec:** Không có file spec riêng (việc được brainstorming phân loại Bounded — thiết kế đã chốt trực tiếp trong hội thoại). Bản ghi quyết định nằm ở đây:
- Nút "Chọn bản này" xuất hiện trên từng thẻ giọng văn (Chuyên nghiệp/Trẻ trung/Hài), bấm vào lộ ra 2 nút dịch ngay tại thẻ đó.
- Dịch được cả 2 ngôn ngữ cho cùng 1 bản đã chọn (không phải chọn 1 trong 2).
- Tiếng Hoa dùng chữ Giản thể.
- Bảng thuật ngữ: hàng "Việt ↔ Anh" cũ tách thành 2 hàng "Dịch sang Tiếng Anh" / "Dịch sang Tiếng Hoa", sửa độc lập.
- Bản dịch lưu vào lịch sử, sửa tay/ghi chú-tạo-lại được y hệt các bản khác.

## Global Constraints

- Không đổi hành vi của 3 giọng văn hiện có (Chuyên nghiệp/Trẻ trung/Hài) — chỉ bỏ tuỳ chọn dịch khỏi bước tạo ban đầu.
- Route `/api/regenerate` khi tạo lại 1 bản dịch phải dùng đúng nội dung của bản gốc đã chọn (kể cả nếu bản đó đã bị sửa tay), KHÔNG dùng `run.inputText` — đây là điểm dễ sai nhất trong toàn bộ việc này.
- File CSDL cũ (đã có từ trước, còn hàng `viet_anh`) phải tự nâng cấp khi mở lại — không được yêu cầu xoá tay `data/ted.db`, vì đây chính là kịch bản "dữ liệu sống sót qua redeploy" mà spec gốc đã yêu cầu.
- Bấm dịch 2 lần cùng 1 ngôn ngữ cho cùng 1 bản nguồn → cập nhật lại đúng thẻ cũ, không tạo thẻ trùng.
- Không có test tự động cho phần giao diện thuần (page.tsx, ResultCard.tsx, CSS) — theo đúng quyết định đã áp dụng nhất quán trong dự án này (kiểm tra bằng tay qua trình duyệt thật).
- Làm trên nhánh git `feature/tro-ly-viet-noi-dung` hiện tại — không tạo nhánh mới, không đụng `main`.

---

## Task 1: Kiểu dữ liệu chung

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: không có
- Produces: `TranslateTarget = 'dich_anh' | 'dich_hoa'`; `Branch = Tone | TranslateTarget`; `GenerateOptions { tones: Tone[] }` (bỏ `translate`); `RunOutput` thêm field `sourceOutputId: number | null`; `BRANCH_LABELS` có đủ 5 khoá (`chuyen_nghiep`, `re_trung`, `hai`, `dich_anh`, `dich_hoa`).

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/types.ts` để lấy đúng nội dung đang có trước khi sửa.

- [ ] **Step 2: Sửa `src/types.ts` — thay toàn bộ nội dung bằng**

```typescript
export type Tone = 'chuyen_nghiep' | 're_trung' | 'hai'
export type TranslateTarget = 'dich_anh' | 'dich_hoa'
export type Branch = Tone | TranslateTarget

export interface GlossaryRule {
  branch: Branch
  xungHo: string
  tuVungUuTien: string
  tuTranh: string
  nhipCau: string
  emoji: string
}

export interface GenerateOptions {
  tones: Tone[]
}

export interface RunOutput {
  id: number
  runId: number
  branch: Branch
  content: string | null
  status: 'pending' | 'success' | 'error'
  errorMessage: string | null
  editedContent: string | null
  regenerateNote: string | null
  sourceOutputId: number | null
}

export interface Run {
  id: number
  inputText: string
  options: GenerateOptions
  createdAt: string
  outputs: RunOutput[]
}

export const BRANCH_LABELS: Record<Branch, string> = {
  chuyen_nghiep: 'Chuyên nghiệp',
  re_trung: 'Trẻ trung',
  hai: 'Hài',
  dich_anh: 'Tiếng Anh',
  dich_hoa: 'Tiếng Hoa',
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Thay Branch 'viet_anh' bằng 'dich_anh'/'dich_hoa', thêm sourceOutputId

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Sẽ có lỗi kiểu dữ liệu ở các file khác cho tới khi Task 2-8 xong — bình thường, các task sau sửa hết.)

---

## Task 2: Validation — bỏ điều kiện "đủ rõ" liên quan dịch

**Files:**
- Modify: `src/lib/validation.ts`
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- Consumes: `GenerateOptions` (Task 1, giờ chỉ còn `{ tones: Tone[] }`)
- Produces: `validateInput(text, options)` — "đủ rõ" giờ chỉ là `tones.length > 0`.

- [ ] **Step 1: Sửa test trước — thay toàn bộ nội dung `src/lib/validation.test.ts` bằng**

```typescript
import { describe, it, expect } from 'vitest'
import { countWords, validateInput, MAX_WORDS } from './validation'

describe('countWords', () => {
  it('đếm đúng số từ cách nhau bởi khoảng trắng', () => {
    expect(countWords('một hai ba')).toBe(3)
  })

  it('trả về 0 với chuỗi rỗng hoặc toàn khoảng trắng', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
  })
})

describe('validateInput', () => {
  it('báo empty khi chưa nhập gì', () => {
    const result = validateInput('', { tones: ['hai'] })
    expect(result).toEqual({ valid: false, reason: 'empty' })
  })

  it('báo too_long khi vượt quá MAX_WORDS', () => {
    const longText = new Array(MAX_WORDS + 1).fill('từ').join(' ')
    const result = validateInput(longText, { tones: ['hai'] })
    expect(result).toEqual({ valid: false, reason: 'too_long' })
  })

  it('báo no_options khi không chọn giọng văn nào', () => {
    const result = validateInput('nội dung mẫu', { tones: [] })
    expect(result).toEqual({ valid: false, reason: 'no_options' })
  })

  it('hợp lệ khi có text và ít nhất 1 giọng văn', () => {
    expect(validateInput('nội dung mẫu', { tones: ['hai'] })).toEqual({ valid: true })
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail** (vì implementation cũ còn đọc `options.translate` không tồn tại trong type mới → lỗi kiểu dữ liệu hoặc hành vi sai)

```bash
npx vitest run src/lib/validation.test.ts
```

- [ ] **Step 3: Sửa `src/lib/validation.ts` — thay toàn bộ nội dung bằng**

```typescript
import type { GenerateOptions } from '@/types'

export const MAX_WORDS = 2000

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).length
}

export interface ValidationResult {
  valid: boolean
  reason?: 'empty' | 'too_long' | 'no_options'
}

export function validateInput(text: string, options: GenerateOptions): ValidationResult {
  const wordCount = countWords(text)
  if (wordCount === 0) return { valid: false, reason: 'empty' }
  if (wordCount > MAX_WORDS) return { valid: false, reason: 'too_long' }
  if (options.tones.length === 0) return { valid: false, reason: 'no_options' }
  return { valid: true }
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/validation.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts
git commit -m "Đơn giản hoá điều kiện đủ rõ: chỉ còn cần >=1 giọng văn

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Prompt builder — tổng quát hoá cho 2 ngôn ngữ dịch

**Files:**
- Modify: `src/lib/promptBuilder.ts`
- Test: `src/lib/promptBuilder.test.ts`

**Interfaces:**
- Consumes: `Branch`, `TranslateTarget`, `GlossaryRule`, `BRANCH_LABELS` (Task 1)
- Produces: `buildPrompt`/`buildRegeneratePrompt` giữ nguyên chữ ký, nhưng nhận diện `dich_anh`/`dich_hoa` thay vì `viet_anh`.

- [ ] **Step 1: Sửa test trước — thay toàn bộ nội dung `src/lib/promptBuilder.test.ts` bằng**

```typescript
import { describe, it, expect } from 'vitest'
import { buildPrompt, buildRegeneratePrompt } from './promptBuilder'
import type { GlossaryRule } from '@/types'

const hai: GlossaryRule = {
  branch: 'hai',
  xungHo: 'tui / bạn',
  tuVungUuTien: 'ẩn dụ phóng đại, tự trào',
  tuTranh: 'giọng nghiêm trọng quá mức',
  nhipCau: 'chốt câu bằng punchline',
  emoji: 'emoji có chọn lọc',
}

const dichAnh: GlossaryRule = {
  branch: 'dich_anh',
  xungHo: 'giữ theo bản gốc',
  tuVungUuTien: 'PvP, skin, buff/nerf',
  tuTranh: 'dịch nghĩa đen thuật ngữ game',
  nhipCau: 'giữ thứ tự thông tin gốc',
  emoji: 'giữ theo bản gốc',
}

const dichHoa: GlossaryRule = {
  branch: 'dich_hoa',
  xungHo: 'giữ theo bản gốc',
  tuVungUuTien: 'PvP, skin, buff/nerf',
  tuTranh: 'dịch nghĩa đen thuật ngữ game',
  nhipCau: 'giữ thứ tự thông tin gốc',
  emoji: 'giữ theo bản gốc',
}

describe('buildPrompt', () => {
  it('với giọng văn thường: chứa nội dung gốc, tên giọng văn thật, và quy tắc', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', hai)
    expect(prompt).toContain('Bản 2.5 ra mắt thứ Sáu.')
    expect(prompt).toContain('giọng văn: Hài.')
    expect(prompt).toContain('chốt câu bằng punchline')
  })

  it('với nhánh dich_anh: dùng câu lệnh dịch sang tiếng Anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_anh', dichAnh)
    expect(prompt).toContain('dịch sang tiếng Anh')
    expect(prompt).toContain('PvP, skin, buff/nerf')
    expect(prompt).not.toContain('tiếng Hoa')
  })

  it('với nhánh dich_hoa: dùng câu lệnh dịch sang tiếng Hoa, khác dich_anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_hoa', dichHoa)
    expect(prompt).toContain('dịch sang tiếng Hoa')
    expect(prompt).not.toContain('tiếng Anh')
  })
})

describe('buildRegeneratePrompt', () => {
  it('nối thêm ghi chú điều chỉnh vào cuối prompt gốc', () => {
    const prompt = buildRegeneratePrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', hai, 'hài hơn nữa')
    expect(prompt).toContain('hài hơn nữa')
    expect(prompt.indexOf('Ghi chú điều chỉnh')).toBeGreaterThan(prompt.indexOf('Bản 2.5 ra mắt thứ Sáu.'))
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/promptBuilder.test.ts
```

- [ ] **Step 3: Sửa `src/lib/promptBuilder.ts` — thay toàn bộ nội dung bằng**

```typescript
import type { Branch, GlossaryRule, TranslateTarget } from '@/types'
import { BRANCH_LABELS } from '@/types'

const TRANSLATE_TARGET_LANGUAGE: Record<TranslateTarget, string> = {
  dich_anh: 'tiếng Anh',
  dich_hoa: 'tiếng Hoa (chữ Giản thể)',
}

function isTranslateTarget(branch: Branch): branch is TranslateTarget {
  return branch === 'dich_anh' || branch === 'dich_hoa'
}

export function buildPrompt(inputText: string, branch: Branch, rule: GlossaryRule): string {
  if (isTranslateTarget(branch)) {
    const language = TRANSLATE_TARGET_LANGUAGE[branch]
    return [
      `Bạn là trợ lý dịch nội dung sang ${language}.`,
      `Giữ nguyên, không dịch các thuật ngữ sau: ${rule.tuVungUuTien}.`,
      `Không dịch nghĩa đen các thuật ngữ bị cấm: ${rule.tuTranh}.`,
      `Giữ đúng thứ tự thông tin gốc: ${rule.nhipCau}.`,
      '',
      'Nội dung gốc:',
      inputText,
      '',
      `Hãy dịch sang ${language}, chỉ trả về bản dịch, không thêm giải thích.`,
    ].join('\n')
  }

  return [
    `Bạn là trợ lý viết lại nội dung theo giọng văn: ${BRANCH_LABELS[branch]}.`,
    `Xưng hô: ${rule.xungHo}.`,
    `Ưu tiên dùng các từ/cụm: ${rule.tuVungUuTien}.`,
    `Tránh dùng: ${rule.tuTranh}.`,
    `Nhịp câu: ${rule.nhipCau}.`,
    `Chính sách emoji: ${rule.emoji}.`,
    '',
    'Nội dung gốc:',
    inputText,
    '',
    'Hãy viết lại theo đúng các quy tắc trên. Chỉ trả về bản viết lại, không thêm giải thích.',
  ].join('\n')
}

export function buildRegeneratePrompt(
  inputText: string,
  branch: Branch,
  rule: GlossaryRule,
  note: string
): string {
  return buildPrompt(inputText, branch, rule) + `\n\nGhi chú điều chỉnh thêm từ người dùng: ${note}`
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/promptBuilder.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/promptBuilder.ts src/lib/promptBuilder.test.ts
git commit -m "Tổng quát hoá prompt dịch cho cả tiếng Anh và tiếng Hoa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: CSDL — thêm cột source_output_id, tự nâng cấp bảng thuật ngữ cũ

**Files:**
- Modify: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: `GlossaryRule` (Task 1)
- Produces: `DEFAULT_GLOSSARY` có 5 dòng (`chuyen_nghiep`, `re_trung`, `hai`, `dich_anh`, `dich_hoa`); bảng `run_outputs` có cột `source_output_id`; `createDb(dbPath)` tự thêm cột thiếu và tự chèn 2 dòng dịch còn thiếu + xoá dòng `viet_anh` cũ nếu có, dù mở file CSDL cũ hay tạo mới.

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/lib/db.ts` để lấy đúng nội dung đang có (đã có `db.pragma('foreign_keys = ON')` từ trước, đừng làm mất dòng đó).

- [ ] **Step 2: Sửa test trước — thay toàn bộ nội dung `src/lib/db.test.ts` bằng**

```typescript
import { describe, it, expect } from 'vitest'
import { createDb, DEFAULT_GLOSSARY } from './db'

describe('createDb', () => {
  it('tạo đủ 3 bảng và seed sẵn bảng thuật ngữ mặc định', () => {
    const db = createDb(':memory:')

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['glossary_rules', 'runs', 'run_outputs']))

    const rows = db.prepare('SELECT * FROM glossary_rules').all()
    expect(rows).toHaveLength(DEFAULT_GLOSSARY.length)

    db.close()
  })

  it('run_outputs có cột source_output_id', () => {
    const db = createDb(':memory:')
    const columns = db.prepare('PRAGMA table_info(run_outputs)').all() as { name: string }[]
    expect(columns.some((c) => c.name === 'source_output_id')).toBe(true)
    db.close()
  })

  it('không seed lại nếu bảng thuật ngữ đã có dữ liệu (mở lại cùng 1 file)', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(os.tmpdir(), `ted-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    const db1 = createDb(tmpPath)
    db1.prepare("UPDATE glossary_rules SET xung_ho = 'đã sửa' WHERE branch = 'hai'").run()
    db1.close()

    const db2 = createDb(tmpPath)
    const row = db2.prepare("SELECT xung_ho FROM glossary_rules WHERE branch = 'hai'").get() as any
    expect(row.xung_ho).toBe('đã sửa')

    db2.close()
    fs.unlinkSync(tmpPath)
  })

  it('mở lại 1 file CSDL cũ (còn hàng viet_anh, thiếu dich_anh/dich_hoa) sẽ tự nâng cấp', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(
      os.tmpdir(),
      `ted-test-migrate-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    )

    const db1 = createDb(tmpPath)
    db1.prepare("DELETE FROM glossary_rules WHERE branch IN ('dich_anh', 'dich_hoa')").run()
    db1.prepare(
      "INSERT INTO glossary_rules (branch, xung_ho, tu_vung_uu_tien, tu_tranh, nhip_cau, emoji) VALUES ('viet_anh', 'x', 'y', 'z', 'w', 'v')"
    ).run()
    db1.close()

    const db2 = createDb(tmpPath)
    const branches = (db2.prepare('SELECT branch FROM glossary_rules').all() as { branch: string }[]).map(
      (r) => r.branch
    )
    expect(branches).toContain('dich_anh')
    expect(branches).toContain('dich_hoa')
    expect(branches).not.toContain('viet_anh')

    db2.close()
    fs.unlinkSync(tmpPath)
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/db.test.ts
```

- [ ] **Step 4: Sửa `src/lib/db.ts` — thay toàn bộ nội dung bằng**

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { GlossaryRule } from '@/types'

export const DEFAULT_GLOSSARY: GlossaryRule[] = [
  {
    branch: 'chuyen_nghiep',
    xungHo: 'chúng tôi / người chơi',
    tuVungUuTien: 'phát hành, chính thức, chương trình',
    tuTranh: 'tiếng lóng, viết tắt',
    nhipCau: 'câu đầy đủ, 18-22 từ',
    emoji: 'không dùng',
  },
  {
    branch: 're_trung',
    xungHo: 'mình / cả nhà / anh em',
    tuVungUuTien: 'đổ bộ, lẹ tay, xịn, toanh',
    tuTranh: 'từ Hán Việt trang trọng',
    nhipCau: 'câu ngắn, nhiều câu cảm',
    emoji: '1-2 emoji, tự nhiên',
  },
  {
    branch: 'hai',
    xungHo: 'tui / bạn',
    tuVungUuTien: 'ẩn dụ phóng đại, tự trào',
    tuTranh: 'giọng nghiêm trọng quá mức',
    nhipCau: 'chốt câu bằng punchline',
    emoji: 'emoji có chọn lọc',
  },
  {
    branch: 'dich_anh',
    xungHo: 'giữ theo bản gốc',
    tuVungUuTien: 'PvP, skin, buff/nerf',
    tuTranh: 'dịch nghĩa đen thuật ngữ game',
    nhipCau: 'giữ thứ tự thông tin gốc',
    emoji: 'giữ theo bản gốc',
  },
  {
    branch: 'dich_hoa',
    xungHo: 'giữ theo bản gốc',
    tuVungUuTien: 'PvP, skin, buff/nerf',
    tuTranh: 'dịch nghĩa đen thuật ngữ game',
    nhipCau: 'giữ thứ tự thông tin gốc',
    emoji: 'giữ theo bản gốc',
  },
]

function migrateRunOutputsSchema(db: Database.Database) {
  const columns = db.prepare('PRAGMA table_info(run_outputs)').all() as { name: string }[]
  const hasSourceOutputId = columns.some((c) => c.name === 'source_output_id')
  if (!hasSourceOutputId) {
    db.exec('ALTER TABLE run_outputs ADD COLUMN source_output_id INTEGER REFERENCES run_outputs(id)')
  }
}

// Chèn các nhánh còn thiếu (dùng cả lúc tạo mới lẫn lúc mở lại 1 file CSDL cũ
// từ trước khi có dich_anh/dich_hoa), và dọn hàng 'viet_anh' đã lỗi thời.
function backfillGlossaryBranches(db: Database.Database) {
  const existingBranches = new Set(
    (db.prepare('SELECT branch FROM glossary_rules').all() as { branch: string }[]).map((r) => r.branch)
  )
  const insert = db.prepare(`
    INSERT INTO glossary_rules (branch, xung_ho, tu_vung_uu_tien, tu_tranh, nhip_cau, emoji)
    VALUES (@branch, @xungHo, @tuVungUuTien, @tuTranh, @nhipCau, @emoji)
  `)
  for (const rule of DEFAULT_GLOSSARY) {
    if (!existingBranches.has(rule.branch)) insert.run(rule)
  }
  db.prepare("DELETE FROM glossary_rules WHERE branch = 'viet_anh'").run()
}

export function createDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS glossary_rules (
      branch TEXT PRIMARY KEY,
      xung_ho TEXT NOT NULL DEFAULT '',
      tu_vung_uu_tien TEXT NOT NULL DEFAULT '',
      tu_tranh TEXT NOT NULL DEFAULT '',
      nhip_cau TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS run_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id),
      branch TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      edited_content TEXT,
      regenerate_note TEXT,
      source_output_id INTEGER REFERENCES run_outputs(id)
    );
  `)
  migrateRunOutputsSchema(db)
  backfillGlossaryBranches(db)
  return db
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  const dataDir = process.env.TED_DATA_DIR || path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  _db = createDb(path.join(dataDir, 'ted.db'))
  return _db
}
```

- [ ] **Step 5: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/db.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "Thêm cột source_output_id, tự nâng cấp bảng thuật ngữ cũ sang dich_anh/dich_hoa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Runs — thêm hàm addOutput, mang theo sourceOutputId

**Files:**
- Modify: `src/lib/runs.ts`
- Test: `src/lib/runs.test.ts`

**Interfaces:**
- Consumes: `createDb` (Task 4), `Branch`, `GenerateOptions`, `Run`, `RunOutput` (Task 1)
- Produces: `addOutput(db, runId, branch, sourceOutputId): RunOutput` — thêm 1 nhánh mới vào 1 lượt đã có; `RunOutput.sourceOutputId` được đọc/ghi đúng ở mọi hàm cũ (`createRun`, `getRun`, `listRuns`).

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/lib/runs.ts` để lấy đúng nội dung đang có.

- [ ] **Step 2: Thêm test trước vào cuối `src/lib/runs.test.ts`** (giữ nguyên các test cũ, chỉ thêm import và 1 test mới)

Thêm `addOutput` vào dòng import đầu file:
```typescript
import { createRun, saveOutputResult, saveEditedContent, saveRegenerateNote, getRun, listRuns, addOutput } from './runs'
```

Thêm test mới vào cuối describe block `'runs'`:
```typescript
  it('addOutput thêm 1 nhánh mới vào lượt đã có, kèm sourceOutputId', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(db, source.id, { status: 'success', content: 'bản hài gốc' })

    const newOutput = addOutput(db, run.id, 'dich_anh', source.id)
    expect(newOutput.branch).toBe('dich_anh')
    expect(newOutput.sourceOutputId).toBe(source.id)
    expect(newOutput.status).toBe('pending')

    const updated = getRun(db, run.id)!
    expect(updated.outputs).toHaveLength(2)
    const found = updated.outputs.find((o) => o.id === newOutput.id)!
    expect(found.sourceOutputId).toBe(source.id)
  })
```

(Lưu ý: các test cũ trong file này gọi `createRun(db, ..., { tones: [...], translate: false }, ...)` — sửa hết các chỗ đó thành `{ tones: [...] }`, bỏ `translate`, vì `GenerateOptions` không còn field đó nữa.)

- [ ] **Step 3: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/runs.test.ts
```

- [ ] **Step 4: Sửa `src/lib/runs.ts` — thay toàn bộ nội dung bằng**

```typescript
import type Database from 'better-sqlite3'
import type { Branch, GenerateOptions, Run, RunOutput } from '@/types'

function rowToOutput(row: any): RunOutput {
  return {
    id: row.id,
    runId: row.run_id,
    branch: row.branch,
    content: row.content,
    status: row.status,
    errorMessage: row.error_message,
    editedContent: row.edited_content,
    regenerateNote: row.regenerate_note,
    sourceOutputId: row.source_output_id,
  }
}

export function createRun(
  db: Database.Database,
  inputText: string,
  options: GenerateOptions,
  branches: Branch[]
): Run {
  const info = db
    .prepare('INSERT INTO runs (input_text, options_json) VALUES (?, ?)')
    .run(inputText, JSON.stringify(options))
  const runId = info.lastInsertRowid as number

  const insertOutput = db.prepare('INSERT INTO run_outputs (run_id, branch, status) VALUES (?, ?, ?)')
  const outputs: RunOutput[] = branches.map((branch) => {
    const outInfo = insertOutput.run(runId, branch, 'pending')
    return {
      id: outInfo.lastInsertRowid as number,
      runId,
      branch,
      content: null,
      status: 'pending',
      errorMessage: null,
      editedContent: null,
      regenerateNote: null,
      sourceOutputId: null,
    }
  })

  const row = db.prepare('SELECT created_at FROM runs WHERE id = ?').get(runId) as { created_at: string }
  return { id: runId, inputText, options, createdAt: row.created_at, outputs }
}

// Thêm 1 nhánh mới vào 1 lượt đã có sẵn — dùng khi dịch 1 bản đã chọn, vì đó
// là nhánh phát sinh sau, không có sẵn từ lúc tạo lượt ban đầu.
export function addOutput(
  db: Database.Database,
  runId: number,
  branch: Branch,
  sourceOutputId: number | null
): RunOutput {
  const info = db
    .prepare('INSERT INTO run_outputs (run_id, branch, status, source_output_id) VALUES (?, ?, ?, ?)')
    .run(runId, branch, 'pending', sourceOutputId)
  return {
    id: info.lastInsertRowid as number,
    runId,
    branch,
    content: null,
    status: 'pending',
    errorMessage: null,
    editedContent: null,
    regenerateNote: null,
    sourceOutputId,
  }
}

export function saveOutputResult(
  db: Database.Database,
  outputId: number,
  result: { status: 'success' | 'error'; content?: string; errorMessage?: string }
): void {
  db.prepare(
    'UPDATE run_outputs SET status = ?, content = ?, error_message = ?, edited_content = NULL WHERE id = ?'
  ).run(result.status, result.content ?? null, result.errorMessage ?? null, outputId)
}

export function saveEditedContent(db: Database.Database, outputId: number, editedContent: string): void {
  db.prepare('UPDATE run_outputs SET edited_content = ? WHERE id = ?').run(editedContent, outputId)
}

export function saveRegenerateNote(db: Database.Database, outputId: number, note: string): void {
  db.prepare('UPDATE run_outputs SET regenerate_note = ? WHERE id = ?').run(note, outputId)
}

export function getRun(db: Database.Database, runId: number): Run | undefined {
  const runRow = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any
  if (!runRow) return undefined
  const outputRows = db.prepare('SELECT * FROM run_outputs WHERE run_id = ? ORDER BY id').all(runId) as any[]
  return {
    id: runRow.id,
    inputText: runRow.input_text,
    options: JSON.parse(runRow.options_json),
    createdAt: runRow.created_at,
    outputs: outputRows.map(rowToOutput),
  }
}

export function listRuns(db: Database.Database, limit = 50): Run[] {
  const runRows = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit) as any[]
  return runRows.map((runRow) => {
    const outputRows = db.prepare('SELECT * FROM run_outputs WHERE run_id = ? ORDER BY id').all(runRow.id) as any[]
    return {
      id: runRow.id,
      inputText: runRow.input_text,
      options: JSON.parse(runRow.options_json),
      createdAt: runRow.created_at,
      outputs: outputRows.map(rowToOutput),
    }
  })
}
```

- [ ] **Step 5: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/runs.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/runs.ts src/lib/runs.test.ts
git commit -m "Thêm addOutput để gắn 1 nhánh dịch mới vào lượt đã có

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: API tạo nội dung — bỏ nhánh dịch khỏi bước tạo ban đầu

**Files:**
- Modify: `src/app/api/generate/route.ts`
- Test: `src/app/api/generate/route.test.ts`

**Interfaces:**
- Consumes: `GenerateOptions` (Task 1, không còn `translate`)
- Produces: route không còn tự thêm nhánh dịch — `branches` giờ chỉ là `[...options.tones]`.

- [ ] **Step 1: Đọc file hiện tại**

Đọc cả `src/app/api/generate/route.ts` và `src/app/api/generate/route.test.ts` để lấy đúng nội dung đang có (file này đã qua fix round trước, có `safeSaveOutputResult` và cơ chế fire-and-forget — giữ nguyên toàn bộ phần đó).

- [ ] **Step 2: Sửa route — chỉ xoá đúng đoạn liên quan tới translate**

Tìm dòng:
```typescript
  const options: GenerateOptions = body.options ?? { tones: [], translate: false }
```
Đổi thành:
```typescript
  const options: GenerateOptions = body.options ?? { tones: [] }
```

Tìm 2 dòng:
```typescript
  const branches: Branch[] = [...options.tones]
  if (options.translate) branches.push('viet_anh')
```
Đổi thành:
```typescript
  const branches: Branch[] = [...options.tones]
```

Không sửa gì khác trong file này.

- [ ] **Step 3: Sửa test — trong mọi lời gọi `POST(makeRequest({ ..., options: { tones: [...], translate: ... } }))`, bỏ hẳn field `translate`**

Ví dụ nếu test cũ có:
```typescript
makeRequest({ inputText: 'xin chào', options: { tones: ['hai'], translate: true } })
```
thì đổi field `tones` để test vẫn kiểm tra được nhiều nhánh cùng lúc mà không cần `translate` nữa, ví dụ:
```typescript
makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
```
và sửa số lượng output kỳ vọng tương ứng (2 tones → 2 outputs, không phải 2 như cũ vì trước đó là 1 tone + 1 dịch). Áp dụng tương tự cho MỌI test case trong file, kể cả test dùng nhánh `'viet_anh'` để giả lập lỗi cố ý — đổi `'viet_anh'` thành `'re_trung'` hoặc tone thứ hai bất kỳ đang dùng trong cùng test đó (mục đích chỉ là có 2 nhánh khác nhau để kiểm tra cách ly lỗi, không quan trọng tên nhánh).

- [ ] **Step 4: Chạy test, sửa tới khi pass**

```bash
npx vitest run src/app/api/generate/route.test.ts
```

- [ ] **Step 5: Chạy toàn bộ suite để chắc không phá task khác**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/generate/route.ts src/app/api/generate/route.test.ts
git commit -m "Bỏ nhánh dịch khỏi bước tạo nội dung ban đầu

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: API tạo lại — dùng đúng nguồn khi tạo lại 1 bản dịch

**Files:**
- Modify: `src/app/api/regenerate/route.ts`
- Test: `src/app/api/regenerate/route.test.ts`

**Interfaces:**
- Consumes: `RunOutput.sourceOutputId` (Task 1), `addOutput`, `saveOutputResult` (Task 5)
- Produces: khi `output.sourceOutputId !== null`, prompt tạo lại dùng nội dung của output nguồn (`editedContent ?? content`) thay vì `run.inputText`.

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/app/api/regenerate/route.ts` và `src/app/api/regenerate/route.test.ts`.

- [ ] **Step 2: Thêm test trước vào cuối `src/app/api/regenerate/route.test.ts`**

Thêm `addOutput` vào import từ `@/lib/runs`, và thêm import `callQwen` từ `@/lib/qwenClient` (để lấy tay vào mock có sẵn trong file — file này đã có `vi.mock('@/lib/qwenClient', ...)`, chỉ cần import thêm để dùng `vi.mocked(callQwen).mockImplementationOnce`).

Thêm test:
```typescript
  it('tạo lại 1 bản dịch thì dùng đúng nội dung nguồn, không phải câu nhập gốc', async () => {
    const run = createRun(testDb, 'CÂU GỐC không được xuất hiện trong prompt dịch', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(testDb, source.id, { status: 'success', content: 'BẢN HÀI ĐÃ CHỌN' })
    const translated = addOutput(testDb, run.id, 'dich_anh', source.id)

    let capturedPrompt = ''
    vi.mocked(callQwen).mockImplementationOnce(async (prompt: string) => {
      capturedPrompt = prompt
      return 'translated text'
    })

    const res = await POST(makeRequest({ runId: run.id, outputId: translated.id, note: '' }))
    expect(res.status).toBe(200)
    expect(capturedPrompt).toContain('BẢN HÀI ĐÃ CHỌN')
    expect(capturedPrompt).not.toContain('CÂU GỐC')
  })
```

- [ ] **Step 3: Chạy test, xác nhận fail**

```bash
npx vitest run src/app/api/regenerate/route.test.ts
```

- [ ] **Step 4: Sửa route — thêm đoạn tính `baseText` trước khi gọi `buildRegeneratePrompt`**

Tìm đoạn hiện có (sau khi đã lấy được `run`, `output`, `rule`):
```typescript
  saveRegenerateNote(db, outputId, note)

  try {
    const content = await callQwen(buildRegeneratePrompt(run.inputText, output.branch, rule, note))
```
Đổi thành:
```typescript
  // Với nhánh dịch (có sourceOutputId), phải dịch lại từ ĐÚNG bản giọng văn đã
  // chọn (có thể đã được sửa tay), không phải từ câu nhập gốc của cả lượt.
  let baseText = run.inputText
  if (output.sourceOutputId !== null) {
    const source = run.outputs.find((o) => o.id === output.sourceOutputId)
    baseText = source?.editedContent ?? source?.content ?? run.inputText
  }

  saveRegenerateNote(db, outputId, note)

  try {
    const content = await callQwen(buildRegeneratePrompt(baseText, output.branch, rule, note))
```

- [ ] **Step 5: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/app/api/regenerate/route.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/regenerate/route.ts src/app/api/regenerate/route.test.ts
git commit -m "Tạo lại 1 bản dịch dùng đúng bản giọng văn đã chọn làm nguồn

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: API dịch mới — `POST /api/translate`

**Files:**
- Create: `src/app/api/translate/route.ts`
- Test: `src/app/api/translate/route.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 4), `getGlossary` (đã có từ trước), `getRun`, `addOutput`, `saveOutputResult` (Task 5), `buildPrompt` (Task 3), `callQwen` (đã có từ trước), `TranslateTarget` (Task 1)
- Produces: route nhận `{ runId, sourceOutputId, targetBranch }`, tạo (hoặc cập nhật nếu đã có) 1 output cho `targetBranch`, trả về `Run` đầy đủ.

- [ ] **Step 1: Viết test trước**

`src/app/api/translate/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createRun, saveOutputResult } from '@/lib/runs'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwen: vi.fn(async () => 'bản dịch giả lập'),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/translate', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

describe('POST /api/translate', () => {
  it('trả 404 khi run không tồn tại', async () => {
    const res = await POST(makeRequest({ runId: 999, sourceOutputId: 1, targetBranch: 'dich_anh' }))
    expect(res.status).toBe(404)
  })

  it('trả 400 khi bản nguồn chưa thành công', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const res = await POST(
      makeRequest({ runId: run.id, sourceOutputId: run.outputs[0].id, targetBranch: 'dich_anh' })
    )
    expect(res.status).toBe(400)
  })

  it('tạo 1 output mới cho nhánh dịch, kèm sourceOutputId trỏ về bản đã chọn', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(testDb, source.id, { status: 'success', content: 'bản hài đã chọn' })

    const res = await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_anh' }))
    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated.outputs).toHaveLength(2)
    const translated = updated.outputs.find((o: any) => o.branch === 'dich_anh')
    expect(translated.status).toBe('success')
    expect(translated.content).toBe('bản dịch giả lập')
    expect(translated.sourceOutputId).toBe(source.id)
  })

  it('bấm dịch lần 2 cùng ngôn ngữ thì cập nhật lại đúng thẻ cũ, không tạo thêm', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(testDb, source.id, { status: 'success', content: 'bản hài đã chọn' })

    await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_anh' }))
    const res2 = await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_anh' }))
    const updated = await res2.json()
    const dichAnhOutputs = updated.outputs.filter((o: any) => o.branch === 'dich_anh')
    expect(dichAnhOutputs).toHaveLength(1)
  })

  it('dịch cùng 1 bản sang cả 2 ngôn ngữ thì ra 2 thẻ riêng', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'] }, ['hai'])
    const source = run.outputs[0]
    saveOutputResult(testDb, source.id, { status: 'success', content: 'bản hài đã chọn' })

    await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_anh' }))
    const res2 = await POST(makeRequest({ runId: run.id, sourceOutputId: source.id, targetBranch: 'dich_hoa' }))
    const updated = await res2.json()
    expect(updated.outputs).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail** (file route chưa tồn tại)

```bash
npx vitest run src/app/api/translate/route.test.ts
```

- [ ] **Step 3: Viết `src/app/api/translate/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getGlossary } from '@/lib/glossary'
import { getRun, addOutput, saveOutputResult } from '@/lib/runs'
import { buildPrompt } from '@/lib/promptBuilder'
import { callQwen } from '@/lib/qwenClient'
import type { TranslateTarget } from '@/types'

const VALID_TARGETS: TranslateTarget[] = ['dich_anh', 'dich_hoa']

export async function POST(request: Request) {
  const body = await request.json()
  const runId: number = body.runId
  const sourceOutputId: number = body.sourceOutputId
  const targetBranch: TranslateTarget = body.targetBranch

  if (!VALID_TARGETS.includes(targetBranch)) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 })
  }

  const db = getDb()
  const run = getRun(db, runId)
  if (!run) {
    return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
  }
  const source = run.outputs.find((o) => o.id === sourceOutputId)
  if (!source || source.status !== 'success') {
    return NextResponse.json({ error: 'source_not_ready' }, { status: 400 })
  }
  const glossary = getGlossary(db)
  const rule = glossary.find((g) => g.branch === targetBranch)
  if (!rule) {
    return NextResponse.json({ error: 'glossary_missing' }, { status: 400 })
  }

  const sourceText = source.editedContent ?? source.content ?? ''

  // Nếu đã dịch nhánh này từ trước (vd bấm lại), dùng lại đúng bản ghi cũ thay
  // vì tạo thêm 1 thẻ trùng lặp cho cùng ngôn ngữ.
  const existing = run.outputs.find((o) => o.branch === targetBranch && o.sourceOutputId === sourceOutputId)
  const output = existing ?? addOutput(db, runId, targetBranch, sourceOutputId)

  try {
    const content = await callQwen(buildPrompt(sourceText, targetBranch, rule))
    saveOutputResult(db, output.id, { status: 'success', content })
  } catch (err) {
    saveOutputResult(db, output.id, { status: 'error', errorMessage: (err as Error).message })
  }

  const finalRun = getRun(db, runId)
  return NextResponse.json(finalRun)
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/app/api/translate/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/translate/route.ts src/app/api/translate/route.test.ts
git commit -m "Thêm API dịch 1 bản đã chọn sang Tiếng Anh hoặc Tiếng Hoa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Giao diện — bỏ ô Việt-Anh, thêm "Chọn bản này" + nút dịch, màu cho 2 nhánh mới

> Không có test tự động cho phần này (giữ đúng quyết định đã áp dụng nhất quán trong dự án — kiểm tra bằng tay qua trình duyệt thật).

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ResultCard.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `TranslateTarget`, `BRANCH_LABELS` (Task 1), API `/api/translate` (Task 8)
- Produces: `ResultCard` nhận thêm prop `onTranslate: (target: TranslateTarget) => void`.

- [ ] **Step 1: Đọc cả 3 file hiện tại** để lấy đúng nội dung đang có.

- [ ] **Step 2: Sửa `src/app/page.tsx`**

- Bỏ state `translate` và chip "Cặp Việt ↔ Anh" khỏi JSX.
- `options` chỉ còn `{ tones: Array.from(tones) }`.
- Đổi thông báo `no_options` thành: `Chọn ít nhất 1 giọng văn nhé.`
- Thêm import `TranslateTarget` từ `@/types`.
- Thêm hàm:
```typescript
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
```
- Truyền thêm prop cho `ResultCard`:
```tsx
              onTranslate={(target) => handleTranslate(output, target)}
```

- [ ] **Step 3: Sửa `src/components/ResultCard.tsx`**

Thêm import `TranslateTarget`, thêm hằng số nhận diện giọng văn gốc, state `chosen`, và khối JSX "Chọn bản này"/2 nút dịch:

```typescript
import type { RunOutput, TranslateTarget } from '@/types'

const TONE_BRANCHES = new Set(['chuyen_nghiep', 're_trung', 'hai'])
```

Thêm `onTranslate` vào props, thêm `const [chosen, setChosen] = useState(false)`, thêm `const canTranslate = TONE_BRANCHES.has(output.branch)`.

Thêm vào cuối JSX (sau khối `result-card-note`):
```tsx
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
            onClick={() => onTranslate('dich_anh')}
          >
            Dịch sang Tiếng Anh
          </button>
          <button
            className="btn btn-sm translate-btn"
            data-target="dich_hoa"
            onClick={() => onTranslate('dich_hoa')}
          >
            Dịch sang Tiếng Hoa
          </button>
        </div>
      )}
```

- [ ] **Step 4: Sửa `src/app/globals.css`**

Tìm dòng:
```css
  --tone-viet-anh: #2ef0a0; /* Mint Blaze */
```
Đổi thành:
```css
  --tone-dich-anh: #2ef0a0; /* Mint Blaze */
  --tone-dich-hoa: #ffe600; /* Neon Lemon */
```

Xoá khối (không còn ô chọn "Cặp Việt ↔ Anh" trong panel tuỳ chọn nữa):
```css
.tone-chip[data-tone="viet_anh"] {
  --accent: var(--tone-viet-anh);
}
```

Ở CẢ 3 chỗ sau (result-card, glossary-card, history-outputs li), tìm khối `[data-branch="viet_anh"] { --accent: var(--tone-viet-anh); }` và thay bằng 2 khối:
```css
[data-branch="dich_anh"] {
  --accent: var(--tone-dich-anh);
}
[data-branch="dich_hoa"] {
  --accent: var(--tone-dich-hoa);
}
```
(giữ nguyên selector gốc phía trước dấu `[`, ví dụ `.result-card[data-branch="dich_anh"]`, `.glossary-card[data-branch="dich_anh"]`, `.history-outputs li[data-branch="dich_anh"]` — chỉ đổi phần tên nhánh và nhân đôi cho 2 ngôn ngữ.)

Thêm mới vào cuối file:
```css
.result-card-translate {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.translate-btn {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--ink-soft);
}

.translate-btn[data-target="dich_anh"] {
  border-color: var(--tone-dich-anh);
}

.translate-btn[data-target="dich_anh"]:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tone-dich-anh) 18%, var(--surface-2));
  color: var(--ink);
}

.translate-btn[data-target="dich_hoa"] {
  border-color: var(--tone-dich-hoa);
}

.translate-btn[data-target="dich_hoa"]:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tone-dich-hoa) 18%, var(--surface-2));
  color: var(--ink);
}
```

- [ ] **Step 5: `npx tsc --noEmit` — xác nhận sạch**

- [ ] **Step 6: Tự kiểm tra bằng tay qua trình duyệt thật** (dev server đã chạy sẵn ở `localhost:3000`, dùng key GreenNode thật đã cấu hình)
  - Trang chính: panel tuỳ chọn KHÔNG còn ô "Cặp Việt ↔ Anh".
  - Tick 1 giọng văn, tạo nội dung → ra đúng 1 thẻ, không có thẻ dịch nào tự sinh.
  - Trên thẻ đó, bấm "Chọn bản này" → hiện 2 nút "Dịch sang Tiếng Anh" / "Dịch sang Tiếng Hoa".
  - Bấm dịch Tiếng Anh → 1 thẻ mới màu mint xuất hiện, đúng nội dung dịch.
  - Bấm tiếp dịch Tiếng Hoa (vẫn trên thẻ gốc) → thêm 1 thẻ màu vàng chanh, không mất thẻ tiếng Anh.
  - Sửa tay thẻ gốc, rồi bấm "Ghi chú, tạo lại" trên thẻ Tiếng Anh → nội dung tạo lại phải phản ánh đúng bản đã sửa tay (không quay về câu nhập ban đầu).
  - Vào `/glossary` → thấy đúng 5 thẻ: Chuyên nghiệp, Trẻ trung, Hài, Tiếng Anh, Tiếng Hoa (không còn "Việt ↔ Anh").
  - Vào `/history` → lượt vừa tạo hiện đủ các nhánh, kể cả 2 bản dịch.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/ResultCard.tsx src/app/globals.css
git commit -m "Chuyển dịch thuật thành hành động sau khi chọn 1 bản, thêm màu 2 ngôn ngữ

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Sau khi xong tất cả các task

- [ ] Chạy lại toàn bộ: `npx tsc --noEmit` và `npx vitest run --exclude '**/.worktrees/**'` — phải sạch, không lỗi, không sót cảnh báo.
- [ ] Chạy lại checklist thủ công ở Task 9 Step 6 một lần cuối, với dữ liệu thật (không phải giả lập).
