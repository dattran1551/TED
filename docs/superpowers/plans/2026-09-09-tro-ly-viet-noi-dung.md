# Trợ lý viết nội dung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây một web app cá nhân (Next.js) nhận 1 đoạn text bất kỳ, sinh song song nhiều bản viết lại (3 giọng văn + 1 cặp Việt-Anh) theo một bảng thuật ngữ có thể sửa, lưu lịch sử, deploy có link truy cập từ xa.

**Architecture:** Next.js App Router, một dự án gộp cả giao diện (React) và backend (Route Handlers). Dữ liệu lưu trong 1 file SQLite (`better-sqlite3`). Gọi mô hình Qwen 3.0 qua GreenNode từ phía server. Deploy bằng Docker + Dokploy, có volume lưu trữ lâu dài cho file SQLite.

**Tech Stack:** Next.js 14 (App Router, TypeScript), better-sqlite3, Vitest (test), Docker, Dokploy.

**Spec:** `docs/superpowers/specs/2026-09-09-tro-ly-viet-noi-dung-design.md`

## Global Constraints

- Chỉ 1 người dùng, không đăng nhập, không phân quyền (spec §2).
- Input tự do, giới hạn **2000 từ**, đếm theo khoảng trắng (spec §4.1, §5).
- "Đủ rõ để tạo" = đã tick ≥1 giọng văn HOẶC bật cặp Việt-Anh — đây là validation thường, **không gọi AI để đoán ý** (spec §5).
- Chỉ **1 bộ bảng thuật ngữ đang hoạt động** — không có nhiều bộ để chọn (spec §4.2, §6).
- Lỗi ở 1 nhánh sinh nội dung không được làm hỏng các nhánh còn lại (spec §4.1, §3 mục Rủi ro).
- API key GreenNode/Qwen chỉ nằm trong `.env` phía server, `.env` nằm trong `.gitignore` (CLAUDE.md §5).
- File SQLite phải sống sót qua các lần deploy lại trên Dokploy (persistent volume) — đây là rủi ro đã được spec đánh dấu, phải xử lý ở Task 16, không để "làm sau".
- Chỉ dùng dữ liệu giả khi viết test/ví dụ, không dùng dữ liệu thật (CLAUDE.md §4).
- Làm việc trên nhánh git `feature/tro-ly-viet-noi-dung` (đã tạo sẵn) — không commit vào `main`.

---

## Task 1: Scaffold dự án

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore` (cập nhật), `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx` (tạm thời, sẽ thay ở Task 12)
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces: cấu trúc dự án Next.js + TypeScript, alias import `@/*` → `src/*`, lệnh `npm test` chạy Vitest, lệnh `npm run dev` chạy dev server.

- [ ] **Step 1: Tạo dự án Next.js**

```bash
npx create-next-app@latest . --typescript --app --eslint --no-tailwind --src-dir --import-alias "@/*" --no-turbopack
```
Khi được hỏi, chọn mặc định cho các câu còn lại.

- [ ] **Step 2: Cài thêm thư viện database và test**

```bash
npm install better-sqlite3
npm install -D vitest @types/better-sqlite3
```

- [ ] **Step 3: Thêm file cấu hình Vitest**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Thêm script test vào `package.json`**

Mở `package.json`, trong `"scripts"` thêm dòng:
```json
"test": "vitest run"
```

- [ ] **Step 5: Thêm `.env.example` và cập nhật `.gitignore`**

`.env.example`:
```
GREENNODE_API_KEY=
GREENNODE_BASE_URL=
TED_DATA_DIR=./data
```

Mở `.gitignore`, thêm 2 dòng (nếu chưa có):
```
.env
/data
```

- [ ] **Step 6: Kiểm tra dev server chạy được**

```bash
npm run dev
```
Mở `http://localhost:3000`, thấy trang mặc định của Next.js hiện ra (chưa cần đẹp, chỉ cần không lỗi).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js project with Vitest and better-sqlite3

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Kiểu dữ liệu chung + logic kiểm tra input

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/validation.ts`
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- Consumes: không có
- Produces:
  - `Tone = 'chuyen_nghiep' | 're_trung' | 'hai'`
  - `Branch = Tone | 'viet_anh'`
  - `GlossaryRule { branch: Branch; xungHo: string; tuVungUuTien: string; tuTranh: string; nhipCau: string; emoji: string }`
  - `GenerateOptions { tones: Tone[]; translate: boolean }`
  - `RunOutput { id: number; runId: number; branch: Branch; content: string | null; status: 'pending' | 'success' | 'error'; errorMessage: string | null; editedContent: string | null; regenerateNote: string | null }`
  - `Run { id: number; inputText: string; options: GenerateOptions; createdAt: string; outputs: RunOutput[] }`
  - `MAX_WORDS: number`
  - `countWords(text: string): number`
  - `validateInput(text: string, options: GenerateOptions): { valid: boolean; reason?: 'empty' | 'too_long' | 'no_options' }`

- [ ] **Step 1: Viết `src/types.ts`**

```typescript
export type Tone = 'chuyen_nghiep' | 're_trung' | 'hai'
export type Branch = Tone | 'viet_anh'

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
  translate: boolean
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
}

export interface Run {
  id: number
  inputText: string
  options: GenerateOptions
  createdAt: string
  outputs: RunOutput[]
}
```

- [ ] **Step 2: Viết test cho `validation.ts` trước (sẽ fail vì chưa có code)**

`src/lib/validation.test.ts`:
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
    const result = validateInput('', { tones: ['hai'], translate: false })
    expect(result).toEqual({ valid: false, reason: 'empty' })
  })

  it('báo too_long khi vượt quá MAX_WORDS', () => {
    const longText = new Array(MAX_WORDS + 1).fill('từ').join(' ')
    const result = validateInput(longText, { tones: ['hai'], translate: false })
    expect(result).toEqual({ valid: false, reason: 'too_long' })
  })

  it('báo no_options khi không chọn giọng văn nào và không bật dịch', () => {
    const result = validateInput('nội dung mẫu', { tones: [], translate: false })
    expect(result).toEqual({ valid: false, reason: 'no_options' })
  })

  it('hợp lệ khi có text và ít nhất 1 tuỳ chọn', () => {
    expect(validateInput('nội dung mẫu', { tones: ['hai'], translate: false })).toEqual({ valid: true })
    expect(validateInput('nội dung mẫu', { tones: [], translate: true })).toEqual({ valid: true })
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/validation.test.ts
```
Kỳ vọng: lỗi vì `./validation` chưa tồn tại.

- [ ] **Step 4: Viết `src/lib/validation.ts`**

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
  const hasAnyOption = options.tones.length > 0 || options.translate
  if (!hasAnyOption) return { valid: false, reason: 'no_options' }
  return { valid: true }
}
```

- [ ] **Step 5: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/validation.test.ts
```
Kỳ vọng: tất cả PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/validation.ts src/lib/validation.test.ts
git commit -m "Add shared types and input validation logic

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Ghép prompt (prompt builder)

**Files:**
- Create: `src/lib/promptBuilder.ts`
- Test: `src/lib/promptBuilder.test.ts`

**Interfaces:**
- Consumes: `Branch`, `GlossaryRule` từ `@/types` (Task 2)
- Produces:
  - `buildPrompt(inputText: string, branch: Branch, rule: GlossaryRule): string`
  - `buildRegeneratePrompt(inputText: string, branch: Branch, rule: GlossaryRule, note: string): string`

- [ ] **Step 1: Viết test trước**

`src/lib/promptBuilder.test.ts`:
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

const vietAnh: GlossaryRule = {
  branch: 'viet_anh',
  xungHo: 'giữ theo bản gốc',
  tuVungUuTien: 'PvP, skin, buff/nerf',
  tuTranh: 'dịch nghĩa đen thuật ngữ game',
  nhipCau: 'giữ thứ tự thông tin gốc',
  emoji: 'giữ theo bản gốc',
}

describe('buildPrompt', () => {
  it('chứa nội dung gốc và các quy tắc của giọng văn', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', hai)
    expect(prompt).toContain('Bản 2.5 ra mắt thứ Sáu.')
    expect(prompt).toContain('tui / bạn')
    expect(prompt).toContain('chốt câu bằng punchline')
  })

  it('dùng câu lệnh dịch riêng cho nhánh viet_anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'viet_anh', vietAnh)
    expect(prompt).toContain('dịch sang tiếng Anh')
    expect(prompt).toContain('PvP, skin, buff/nerf')
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

- [ ] **Step 3: Viết `src/lib/promptBuilder.ts`**

```typescript
import type { Branch, GlossaryRule } from '@/types'

export function buildPrompt(inputText: string, branch: Branch, rule: GlossaryRule): string {
  if (branch === 'viet_anh') {
    return [
      'Bạn là trợ lý dịch nội dung sang tiếng Anh.',
      `Giữ nguyên, không dịch các thuật ngữ sau: ${rule.tuVungUuTien}.`,
      `Không dịch nghĩa đen các thuật ngữ bị cấm: ${rule.tuTranh}.`,
      `Giữ đúng thứ tự thông tin gốc: ${rule.nhipCau}.`,
      '',
      'Nội dung gốc:',
      inputText,
      '',
      'Hãy dịch sang tiếng Anh, chỉ trả về bản dịch, không thêm giải thích.',
    ].join('\n')
  }

  return [
    `Bạn là trợ lý viết lại nội dung theo giọng văn: ${branch}.`,
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
git commit -m "Add prompt builder for tone rewrite and translation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Database SQLite + bảng thuật ngữ mặc định

**Files:**
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: `GlossaryRule` từ `@/types`
- Produces:
  - `createDb(dbPath: string): Database.Database` — tạo (hoặc mở) db tại đường dẫn, tạo bảng nếu chưa có, seed bảng thuật ngữ mặc định nếu bảng rỗng.
  - `getDb(): Database.Database` — trả về db singleton dùng chung cho cả app (đường dẫn lấy từ biến môi trường `TED_DATA_DIR`).
  - `DEFAULT_GLOSSARY: GlossaryRule[]` — 4 dòng mặc định (3 giọng văn + Việt-Anh).

- [ ] **Step 1: Viết test trước**

`src/lib/db.test.ts`:
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

  it('không seed lại nếu bảng thuật ngữ đã có dữ liệu (mở lại cùng 1 file)', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(os.tmpdir(), `ted-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    const db1 = createDb(tmpPath)
    db1.prepare("UPDATE glossary_rules SET xung_ho = 'đã sửa' WHERE branch = 'hai'").run()
    db1.close()

    // Giả lập mở lại app: gọi createDb lần nữa trên CÙNG 1 file.
    const db2 = createDb(tmpPath)
    const row = db2.prepare("SELECT xung_ho FROM glossary_rules WHERE branch = 'hai'").get() as any
    expect(row.xung_ho).toBe('đã sửa') // nếu seed chạy lại, giá trị này sẽ bị ghi đè về mặc định

    db2.close()
    fs.unlinkSync(tmpPath)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/db.test.ts
```

- [ ] **Step 3: Viết `src/lib/db.ts`**

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
    branch: 'viet_anh',
    xungHo: 'giữ theo bản gốc',
    tuVungUuTien: 'PvP, skin, buff/nerf',
    tuTranh: 'dịch nghĩa đen thuật ngữ game',
    nhipCau: 'giữ thứ tự thông tin gốc',
    emoji: 'giữ theo bản gốc',
  },
]

function seedDefaultGlossary(db: Database.Database) {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM glossary_rules').get() as { c: number }
  if (c > 0) return
  const insert = db.prepare(`
    INSERT INTO glossary_rules (branch, xung_ho, tu_vung_uu_tien, tu_tranh, nhip_cau, emoji)
    VALUES (@branch, @xungHo, @tuVungUuTien, @tuTranh, @nhipCau, @emoji)
  `)
  const insertMany = db.transaction((rules: GlossaryRule[]) => {
    for (const rule of rules) insert.run(rule)
  })
  insertMany(DEFAULT_GLOSSARY)
}

export function createDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
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
      regenerate_note TEXT
    );
  `)
  seedDefaultGlossary(db)
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

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/db.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "Add SQLite schema, connection, and default glossary seed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Đọc/ghi bảng thuật ngữ

**Files:**
- Create: `src/lib/glossary.ts`
- Test: `src/lib/glossary.test.ts`

**Interfaces:**
- Consumes: `createDb` (Task 4), `GlossaryRule`, `Branch` (Task 2)
- Produces:
  - `getGlossary(db): GlossaryRule[]`
  - `getGlossaryRule(db, branch: Branch): GlossaryRule | undefined`
  - `updateGlossaryRule(db, rule: GlossaryRule): void`

- [ ] **Step 1: Viết test trước**

`src/lib/glossary.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDb } from './db'
import { getGlossary, getGlossaryRule, updateGlossaryRule } from './glossary'

let db: Database.Database

beforeEach(() => {
  db = createDb(':memory:')
})

describe('glossary', () => {
  it('getGlossary trả về 4 dòng mặc định', () => {
    expect(getGlossary(db)).toHaveLength(4)
  })

  it('getGlossaryRule lấy đúng 1 dòng theo branch', () => {
    const rule = getGlossaryRule(db, 'hai')
    expect(rule?.branch).toBe('hai')
    expect(rule?.xungHo).toBe('tui / bạn')
  })

  it('updateGlossaryRule ghi đè đúng dòng, không ảnh hưởng dòng khác', () => {
    updateGlossaryRule(db, {
      branch: 'hai',
      xungHo: 'tao / mày (test)',
      tuVungUuTien: 'x',
      tuTranh: 'y',
      nhipCau: 'z',
      emoji: 'w',
    })
    expect(getGlossaryRule(db, 'hai')?.xungHo).toBe('tao / mày (test)')
    expect(getGlossaryRule(db, 'chuyen_nghiep')?.xungHo).toBe('chúng tôi / người chơi')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/glossary.test.ts
```

- [ ] **Step 3: Viết `src/lib/glossary.ts`**

```typescript
import type Database from 'better-sqlite3'
import type { Branch, GlossaryRule } from '@/types'

function rowToRule(row: any): GlossaryRule {
  return {
    branch: row.branch,
    xungHo: row.xung_ho,
    tuVungUuTien: row.tu_vung_uu_tien,
    tuTranh: row.tu_tranh,
    nhipCau: row.nhip_cau,
    emoji: row.emoji,
  }
}

export function getGlossary(db: Database.Database): GlossaryRule[] {
  const rows = db.prepare('SELECT * FROM glossary_rules').all()
  return rows.map(rowToRule)
}

export function getGlossaryRule(db: Database.Database, branch: Branch): GlossaryRule | undefined {
  const row = db.prepare('SELECT * FROM glossary_rules WHERE branch = ?').get(branch)
  return row ? rowToRule(row) : undefined
}

export function updateGlossaryRule(db: Database.Database, rule: GlossaryRule): void {
  db.prepare(
    `UPDATE glossary_rules
     SET xung_ho = @xungHo, tu_vung_uu_tien = @tuVungUuTien, tu_tranh = @tuTranh, nhip_cau = @nhipCau, emoji = @emoji
     WHERE branch = @branch`
  ).run(rule)
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/glossary.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/glossary.ts src/lib/glossary.test.ts
git commit -m "Add glossary read/update functions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Đọc/ghi lượt tạo (runs) và lịch sử

**Files:**
- Create: `src/lib/runs.ts`
- Test: `src/lib/runs.test.ts`

**Interfaces:**
- Consumes: `createDb` (Task 4), `Branch`, `GenerateOptions`, `Run`, `RunOutput` (Task 2)
- Produces:
  - `createRun(db, inputText: string, options: GenerateOptions, branches: Branch[]): Run`
  - `saveOutputResult(db, outputId: number, result: { status: 'success' | 'error'; content?: string; errorMessage?: string }): void`
  - `saveEditedContent(db, outputId: number, editedContent: string): void`
  - `saveRegenerateNote(db, outputId: number, note: string): void`
  - `getRun(db, runId: number): Run | undefined`
  - `listRuns(db, limit?: number): Run[]`

- [ ] **Step 1: Viết test trước**

`src/lib/runs.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDb } from './db'
import {
  createRun,
  saveOutputResult,
  saveEditedContent,
  saveRegenerateNote,
  getRun,
  listRuns,
} from './runs'

let db: Database.Database

beforeEach(() => {
  db = createDb(':memory:')
})

describe('runs', () => {
  it('createRun tạo 1 run và đủ output cho từng nhánh, trạng thái pending', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'], translate: true }, ['hai', 'viet_anh'])
    expect(run.inputText).toBe('nội dung mẫu')
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o) => o.status === 'pending')).toBe(true)
  })

  it('saveOutputResult cập nhật đúng 1 output, không đụng output khác', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'], translate: true }, ['hai', 'viet_anh'])
    const [first, second] = run.outputs
    saveOutputResult(db, first.id, { status: 'success', content: 'bản hài' })
    saveOutputResult(db, second.id, { status: 'error', errorMessage: 'lỗi mạng' })

    const updated = getRun(db, run.id)!
    const updatedFirst = updated.outputs.find((o) => o.id === first.id)!
    const updatedSecond = updated.outputs.find((o) => o.id === second.id)!
    expect(updatedFirst).toMatchObject({ status: 'success', content: 'bản hài' })
    expect(updatedSecond).toMatchObject({ status: 'error', errorMessage: 'lỗi mạng' })
  })

  it('saveEditedContent và saveRegenerateNote ghi đúng cột', () => {
    const run = createRun(db, 'nội dung mẫu', { tones: ['hai'], translate: false }, ['hai'])
    const output = run.outputs[0]
    saveEditedContent(db, output.id, 'bản đã sửa tay')
    saveRegenerateNote(db, output.id, 'hài hơn nữa')

    const updated = getRun(db, run.id)!
    expect(updated.outputs[0].editedContent).toBe('bản đã sửa tay')
    expect(updated.outputs[0].regenerateNote).toBe('hài hơn nữa')
  })

  it('listRuns trả về run mới nhất trước', () => {
    createRun(db, 'run 1', { tones: ['hai'], translate: false }, ['hai'])
    createRun(db, 'run 2', { tones: ['hai'], translate: false }, ['hai'])

    const runs = listRuns(db)
    expect(runs).toHaveLength(2)
    expect(runs[0].inputText).toBe('run 2')
  })

  it('listRuns trả về mảng rỗng khi chưa có lượt nào', () => {
    expect(listRuns(db)).toEqual([])
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/runs.test.ts
```

- [ ] **Step 3: Viết `src/lib/runs.ts`**

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
    }
  })

  const row = db.prepare('SELECT created_at FROM runs WHERE id = ?').get(runId) as { created_at: string }
  return { id: runId, inputText, options, createdAt: row.created_at, outputs }
}

export function saveOutputResult(
  db: Database.Database,
  outputId: number,
  result: { status: 'success' | 'error'; content?: string; errorMessage?: string }
): void {
  db.prepare('UPDATE run_outputs SET status = ?, content = ?, error_message = ? WHERE id = ?').run(
    result.status,
    result.content ?? null,
    result.errorMessage ?? null,
    outputId
  )
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
  const outputRows = db.prepare('SELECT * FROM run_outputs WHERE run_id = ?').all(runId) as any[]
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
    const outputRows = db.prepare('SELECT * FROM run_outputs WHERE run_id = ?').all(runRow.id) as any[]
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

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/runs.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/runs.ts src/lib/runs.test.ts
git commit -m "Add run and history read/write functions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Gọi Qwen 3.0 qua GreenNode

⚠️ **Trước khi làm task này:** xác nhận với bạn (chủ dự án) endpoint thật, tên model, và format request/response của GreenNode — code dưới đây viết theo chuẩn phổ biến kiểu OpenAI (`/chat/completions`, `choices[0].message.content`) vì đó là giả định hợp lý nhất, nhưng **cần đối chiếu với tài liệu GreenNode thật trước khi chạy task này với key thật**. Nếu format khác, chỉ cần sửa trong file `qwenClient.ts`, các phần khác của app không bị ảnh hưởng.

**Files:**
- Create: `src/lib/qwenClient.ts`
- Test: `src/lib/qwenClient.test.ts`

**Interfaces:**
- Consumes: biến môi trường `GREENNODE_API_KEY`, `GREENNODE_BASE_URL`
- Produces:
  - `callQwen(prompt: string): Promise<string>`
  - `QwenCallError extends Error`

- [ ] **Step 1: Viết test trước (mock `fetch`)**

`src/lib/qwenClient.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('callQwen', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.GREENNODE_BASE_URL = 'https://fake-greennode.test/v1'
    process.env.GREENNODE_API_KEY = 'fake-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.resetModules()
  })

  it('trả về nội dung khi API thành công', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'bản viết lại' } }] }),
    }) as any

    const { callQwen } = await import('./qwenClient')
    const result = await callQwen('prompt bất kỳ')
    expect(result).toBe('bản viết lại')
  })

  it('ném QwenCallError khi API trả lỗi HTTP', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any

    const { callQwen, QwenCallError } = await import('./qwenClient')
    await expect(callQwen('prompt bất kỳ')).rejects.toBeInstanceOf(QwenCallError)
  })

  it('ném QwenCallError khi response không đúng định dạng', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

    const { callQwen, QwenCallError } = await import('./qwenClient')
    await expect(callQwen('prompt bất kỳ')).rejects.toBeInstanceOf(QwenCallError)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/lib/qwenClient.test.ts
```

- [ ] **Step 3: Viết `src/lib/qwenClient.ts`**

```typescript
export class QwenCallError extends Error {}

export async function callQwen(prompt: string): Promise<string> {
  const baseUrl = process.env.GREENNODE_BASE_URL || ''
  const apiKey = process.env.GREENNODE_API_KEY || ''

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen3',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new QwenCallError(`GreenNode trả lỗi HTTP ${response.status}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new QwenCallError('GreenNode trả về dữ liệu không đúng định dạng mong đợi')
  }
  return content
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/qwenClient.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/qwenClient.ts src/lib/qwenClient.test.ts
git commit -m "Add GreenNode/Qwen API client with error handling

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: API tạo nội dung — `POST /api/generate`

**Files:**
- Create: `src/app/api/generate/route.ts`
- Test: `src/app/api/generate/route.test.ts`

**Interfaces:**
- Consumes: `validateInput` (Task 2), `getDb`, `createDb` (Task 4), `getGlossary` (Task 5), `createRun`, `saveOutputResult`, `getRun` (Task 6), `buildPrompt` (Task 3), `callQwen` (Task 7)
- Produces: route `POST` nhận `{ inputText, options }`, trả về `Run` đầy đủ (bao gồm `outputs` đã có kết quả hoặc lỗi từng nhánh) hoặc `400` kèm `{ error: reason }` nếu input không hợp lệ.

- [ ] **Step 1: Viết test trước (mock `qwenClient` và `db`)**

`src/app/api/generate/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwen: vi.fn(async (prompt: string) => {
    if (prompt.includes('THROW')) throw new Error('lỗi giả lập')
    return 'bản viết lại giả lập'
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

describe('POST /api/generate', () => {
  it('trả 400 khi không có tuỳ chọn nào được chọn', async () => {
    const res = await POST(makeRequest({ inputText: 'xin chào', options: { tones: [], translate: false } }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('no_options')
  })

  it('sinh đủ số bản theo tuỳ chọn, mỗi bản có nội dung', async () => {
    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai'], translate: true } })
    )
    expect(res.status).toBe(200)
    const run = await res.json()
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o: any) => o.status === 'success')).toBe(true)
  })

  it('nhánh lỗi không ảnh hưởng nhánh còn lại', async () => {
    const res = await POST(
      makeRequest({ inputText: 'THROW nội dung lỗi', options: { tones: ['hai'], translate: true } })
    )
    const run = await res.json()
    // cả 2 nhánh dùng chung inputText nên cả 2 sẽ lỗi trong test này —
    // kiểm tra riêng: status đều là 'error' và vẫn trả đủ outputs, không throw ở route.
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o: any) => o.status === 'error')).toBe(true)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/app/api/generate/route.test.ts
```

- [ ] **Step 3: Viết `src/app/api/generate/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getGlossary } from '@/lib/glossary'
import { createRun, saveOutputResult, getRun } from '@/lib/runs'
import { validateInput } from '@/lib/validation'
import { buildPrompt } from '@/lib/promptBuilder'
import { callQwen } from '@/lib/qwenClient'
import type { Branch, GenerateOptions } from '@/types'

export async function POST(request: Request) {
  const body = await request.json()
  const inputText: string = body.inputText ?? ''
  const options: GenerateOptions = body.options ?? { tones: [], translate: false }

  const validation = validateInput(inputText, options)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  const db = getDb()
  const branches: Branch[] = [...options.tones]
  if (options.translate) branches.push('viet_anh')

  const run = createRun(db, inputText, options, branches)
  const glossary = getGlossary(db)

  await Promise.all(
    run.outputs.map(async (output) => {
      const rule = glossary.find((g) => g.branch === output.branch)
      if (!rule) {
        saveOutputResult(db, output.id, { status: 'error', errorMessage: 'Thiếu bảng thuật ngữ cho nhánh này' })
        return
      }
      try {
        const content = await callQwen(buildPrompt(inputText, output.branch, rule))
        saveOutputResult(db, output.id, { status: 'success', content })
      } catch (err) {
        saveOutputResult(db, output.id, { status: 'error', errorMessage: (err as Error).message })
      }
    })
  )

  const finalRun = getRun(db, run.id)
  return NextResponse.json(finalRun)
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/app/api/generate/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate/route.ts src/app/api/generate/route.test.ts
git commit -m "Add POST /api/generate route with per-branch error isolation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: API sửa tay + tạo lại 1 nhánh

**Files:**
- Create: `src/app/api/edit-output/route.ts`
- Create: `src/app/api/regenerate/route.ts`
- Test: `src/app/api/regenerate/route.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 4), `getGlossary` (Task 5), `getRun`, `saveOutputResult`, `saveEditedContent`, `saveRegenerateNote` (Task 6), `buildRegeneratePrompt` (Task 3), `callQwen` (Task 7)
- Produces:
  - `POST /api/edit-output` nhận `{ outputId, editedContent }`, trả `{ ok: true }`.
  - `POST /api/regenerate` nhận `{ runId, outputId, note }`, trả `Run` đã cập nhật hoặc `404` nếu không tìm thấy run/output.

- [ ] **Step 1: Viết test trước cho `/api/regenerate`**

`src/app/api/regenerate/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createRun } from '@/lib/runs'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwen: vi.fn(async () => 'bản đã tạo lại'),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/regenerate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

describe('POST /api/regenerate', () => {
  it('trả 404 khi run không tồn tại', async () => {
    const res = await POST(makeRequest({ runId: 999, outputId: 1, note: 'test' }))
    expect(res.status).toBe(404)
  })

  it('chỉ cập nhật đúng output được yêu cầu, giữ nguyên các output khác', async () => {
    const run = createRun(testDb, 'nội dung mẫu', { tones: ['hai'], translate: true }, ['hai', 'viet_anh'])
    const [target, other] = run.outputs

    const res = await POST(makeRequest({ runId: run.id, outputId: target.id, note: 'hài hơn nữa' }))
    expect(res.status).toBe(200)
    const updated = await res.json()

    const updatedTarget = updated.outputs.find((o: any) => o.id === target.id)
    const updatedOther = updated.outputs.find((o: any) => o.id === other.id)
    expect(updatedTarget.status).toBe('success')
    expect(updatedTarget.content).toBe('bản đã tạo lại')
    expect(updatedTarget.regenerateNote).toBe('hài hơn nữa')
    expect(updatedOther.status).toBe('pending')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/app/api/regenerate/route.test.ts
```

- [ ] **Step 3: Viết `src/app/api/regenerate/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getGlossary } from '@/lib/glossary'
import { getRun, saveOutputResult, saveRegenerateNote } from '@/lib/runs'
import { buildRegeneratePrompt } from '@/lib/promptBuilder'
import { callQwen } from '@/lib/qwenClient'

export async function POST(request: Request) {
  const body = await request.json()
  const runId: number = body.runId
  const outputId: number = body.outputId
  const note: string = body.note ?? ''

  const db = getDb()
  const run = getRun(db, runId)
  if (!run) {
    return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
  }
  const output = run.outputs.find((o) => o.id === outputId)
  if (!output) {
    return NextResponse.json({ error: 'output_not_found' }, { status: 404 })
  }
  const glossary = getGlossary(db)
  const rule = glossary.find((g) => g.branch === output.branch)
  if (!rule) {
    return NextResponse.json({ error: 'glossary_missing' }, { status: 400 })
  }

  saveRegenerateNote(db, outputId, note)

  try {
    const content = await callQwen(buildRegeneratePrompt(run.inputText, output.branch, rule, note))
    saveOutputResult(db, outputId, { status: 'success', content })
  } catch (err) {
    saveOutputResult(db, outputId, { status: 'error', errorMessage: (err as Error).message })
  }

  const finalRun = getRun(db, runId)
  return NextResponse.json(finalRun)
}
```

- [ ] **Step 4: Viết `src/app/api/edit-output/route.ts`** (không cần test riêng — logic ghi đã được test ở Task 6, route này chỉ nối HTTP vào hàm đã test)

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { saveEditedContent } from '@/lib/runs'

export async function POST(request: Request) {
  const body = await request.json()
  const outputId: number = body.outputId
  const editedContent: string = body.editedContent ?? ''

  const db = getDb()
  saveEditedContent(db, outputId, editedContent)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Chạy lại test regenerate, xác nhận pass**

```bash
npx vitest run src/app/api/regenerate/route.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/regenerate/route.ts src/app/api/regenerate/route.test.ts src/app/api/edit-output/route.ts
git commit -m "Add regenerate-single-branch and edit-output routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: API bảng thuật ngữ — `GET/PUT /api/glossary`

**Files:**
- Create: `src/app/api/glossary/route.ts`
- Test: `src/app/api/glossary/route.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 4), `getGlossary`, `updateGlossaryRule` (Task 5)
- Produces: `GET` trả `GlossaryRule[]`; `PUT` nhận `{ rules: GlossaryRule[] }`, trả `400` kèm `{ error: 'missing_required_field', branch }` nếu thiếu `xungHo`/`tuVungUuTien`/`nhipCau`, ngược lại lưu và trả `GlossaryRule[]` mới nhất.

- [ ] **Step 1: Viết test trước**

`src/app/api/glossary/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { GET, PUT } from './route'

function makePutRequest(body: unknown) {
  return new Request('http://localhost/api/glossary', { method: 'PUT', body: JSON.stringify(body) })
}

describe('GET /api/glossary', () => {
  it('trả về 4 dòng mặc định', async () => {
    const res = await GET()
    const rules = await res.json()
    expect(rules).toHaveLength(4)
  })
})

describe('PUT /api/glossary', () => {
  it('trả 400 khi thiếu trường bắt buộc', async () => {
    const res = await PUT(
      makePutRequest({
        rules: [{ branch: 'hai', xungHo: '', tuVungUuTien: 'x', tuTranh: 'y', nhipCau: 'z', emoji: 'w' }],
      })
    )
    expect(res.status).toBe(400)
  })

  it('lưu thành công khi đủ trường bắt buộc', async () => {
    const res = await PUT(
      makePutRequest({
        rules: [
          {
            branch: 'hai',
            xungHo: 'tao / mày',
            tuVungUuTien: 'x',
            tuTranh: 'y',
            nhipCau: 'z',
            emoji: 'w',
          },
        ],
      })
    )
    expect(res.status).toBe(200)
    const rules = await res.json()
    expect(rules.find((r: any) => r.branch === 'hai').xungHo).toBe('tao / mày')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/app/api/glossary/route.test.ts
```

- [ ] **Step 3: Viết `src/app/api/glossary/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getGlossary, updateGlossaryRule } from '@/lib/glossary'
import type { GlossaryRule } from '@/types'

export async function GET() {
  const db = getDb()
  return NextResponse.json(getGlossary(db))
}

export async function PUT(request: Request) {
  const body = await request.json()
  const rules: GlossaryRule[] = body.rules ?? []

  for (const rule of rules) {
    if (!rule.xungHo || !rule.tuVungUuTien || !rule.nhipCau) {
      return NextResponse.json({ error: 'missing_required_field', branch: rule.branch }, { status: 400 })
    }
  }

  const db = getDb()
  for (const rule of rules) {
    updateGlossaryRule(db, rule)
  }
  return NextResponse.json(getGlossary(db))
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/app/api/glossary/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/glossary/route.ts src/app/api/glossary/route.test.ts
git commit -m "Add glossary GET/PUT route with required-field validation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: API lịch sử — `GET /api/history`

**Files:**
- Create: `src/app/api/history/route.ts`
- Test: `src/app/api/history/route.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 4), `listRuns` (Task 6)
- Produces: `GET` trả `Run[]`, mới nhất trước.

- [ ] **Step 1: Viết test trước**

`src/app/api/history/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createRun } from '@/lib/runs'

const testDb = createDb(':memory:')

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

import { GET } from './route'

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

describe('GET /api/history', () => {
  it('trả về mảng rỗng khi chưa có lượt nào', async () => {
    const res = await GET()
    expect(await res.json()).toEqual([])
  })

  it('trả về các lượt đã tạo, mới nhất trước', async () => {
    createRun(testDb, 'run cũ', { tones: ['hai'], translate: false }, ['hai'])
    createRun(testDb, 'run mới', { tones: ['hai'], translate: false }, ['hai'])

    const res = await GET()
    const runs = await res.json()
    expect(runs[0].inputText).toBe('run mới')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
npx vitest run src/app/api/history/route.test.ts
```

- [ ] **Step 3: Viết `src/app/api/history/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { listRuns } from '@/lib/runs'

export async function GET() {
  const db = getDb()
  return NextResponse.json(listRuns(db))
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/app/api/history/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/history/route.ts src/app/api/history/route.test.ts
git commit -m "Add GET /api/history route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Trang chính — nhập liệu, tuỳ chọn, kết quả

> Từ đây trở đi là giao diện. Theo quyết định trong spec (§4), việc kiểm tra dùng **checklist tự bấm thử thủ công** thay vì test tự động — hợp với việc đây là app cá nhân và bạn muốn tự tay xác nhận từng thứ chạy đúng, không phải đọc code test.

**Files:**
- Create: `src/components/ResultCard.tsx`
- Modify: `src/app/page.tsx` (thay nội dung mặc định từ Task 1)

**Interfaces:**
- Consumes: `MAX_WORDS`, `countWords`, `validateInput` (Task 2), `Tone`, `GenerateOptions`, `Run`, `RunOutput` (Task 2), API `/api/generate`, `/api/regenerate`, `/api/edit-output` (Task 8, 9)
- Produces: component `ResultCard({ output: RunOutput; onRegenerate: (note: string) => void; onSaveEdit: (text: string) => void })`; trang chính hoàn chỉnh.

- [ ] **Step 1: Viết `src/components/ResultCard.tsx`**

```tsx
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
```

- [ ] **Step 2: Viết `src/app/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { MAX_WORDS, countWords, validateInput } from '@/lib/validation'
import { ResultCard } from '@/components/ResultCard'
import type { Run, RunOutput, GenerateOptions, Tone } from '@/types'

const TONE_LABELS: Record<Tone, string> = {
  chuyen_nghiep: 'Chuyên nghiệp',
  re_trung: 'Trẻ trung',
  hai: 'Hài',
}

export default function HomePage() {
  const [inputText, setInputText] = useState('')
  const [tones, setTones] = useState<Set<Tone>>(new Set())
  const [translate, setTranslate] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const wordCount = countWords(inputText)
  const options: GenerateOptions = { tones: Array.from(tones), translate }
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
      const data = await res.json()
      setRun(data)
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
      setRun({
        ...run,
        outputs: run.outputs.map((o) => (o.id === output.id ? { ...o, editedContent } : o)),
      })
    } catch {
      setActionError('Không lưu được bản sửa, thử lại sau.')
    }
  }

  return (
    <main>
      <h1>Trợ lý viết nội dung</h1>

      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Dán yêu cầu của bạn vào đây..."
      />
      <p>
        {wordCount} / {MAX_WORDS} từ
      </p>

      <fieldset>
        <legend>Giọng văn</legend>
        {(Object.keys(TONE_LABELS) as Tone[]).map((tone) => (
          <label key={tone}>
            <input type="checkbox" checked={tones.has(tone)} onChange={() => toggleTone(tone)} />
            {TONE_LABELS[tone]}
          </label>
        ))}
        <label>
          <input type="checkbox" checked={translate} onChange={(e) => setTranslate(e.target.checked)} />
          Cặp Việt ↔ Anh
        </label>
      </fieldset>

      {blockedReason === 'no_options' && (
        <p role="alert">Chọn ít nhất 1 giọng văn hoặc bật cặp Việt-Anh nhé.</p>
      )}
      {blockedReason === 'too_long' && <p role="alert">Đoạn nhập vượt quá {MAX_WORDS} từ.</p>}
      {blockedReason === 'empty' && <p role="alert">Nhập nội dung trước đã.</p>}
      {actionError && <p role="alert">{actionError}</p>}

      <button onClick={handleSubmit} disabled={!validation.valid || submitting}>
        {submitting ? 'Đang tạo...' : 'Tạo nội dung'}
      </button>

      {run && (
        <section>
          {run.outputs.map((output) => (
            <ResultCard
              key={output.id}
              output={output}
              onRegenerate={(note) => handleRegenerate(output, note)}
              onSaveEdit={(text) => handleSaveEdit(output, text)}
            />
          ))}
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Chạy dev server, tự kiểm tra bằng tay**

```bash
npm run dev
```
Mở `http://localhost:3000`, kiểm tra:
- Dán gì đó, không tick gì, bấm "Tạo nội dung" → thấy dòng "Chọn ít nhất 1 giọng văn hoặc bật cặp Việt-Anh nhé.", nút bị mờ/không chạy.
- Tick 1 giọng văn, bấm tạo → sau vài giây thấy đúng 1 thẻ kết quả.
- Tick cả 3 giọng + bật Việt-Anh, bấm tạo → thấy đủ 4 thẻ.
- Dán đoạn hơn 2000 từ (copy lặp lại 1 câu nhiều lần) → thấy cảnh báo vượt giới hạn, không cho bấm.
- Tắt server (Ctrl+C ở terminal chạy `npm run dev`) rồi bấm "Tạo nội dung" → thấy dòng "Không gọi được AI, thử lại sau.", không phải màn hình trắng hay treo. Bật lại server để tiếp tục kiểm tra các bước sau.

*(Ghi chú: bước này cần Task 7 đã có key GreenNode thật để thấy kết quả thật; nếu chưa có key, các thẻ sẽ hiện lỗi — vẫn kiểm tra được là lỗi hiển thị đúng chỗ, đúng thẻ, không vỡ cả trang.)*

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/ResultCard.tsx
git commit -m "Build main page: input, options, parallel results

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Nối "sửa tay" và "ghi chú, tạo lại" — kiểm tra hành vi độc lập giữa các nhánh

> Phần code UI đã viết ở Task 12 (`ResultCard`, `handleSaveEdit`, `handleRegenerate`). Task này tập trung **xác nhận hành vi**: sửa/tạo lại 1 nhánh không ảnh hưởng nhánh khác — logic phần backend (route `/api/regenerate`) đã có test tự động ở Task 9; task này bổ sung kiểm tra thủ công phía giao diện.

**Files:**
- Không tạo file mới — chỉ chạy kiểm tra.

**Interfaces:**
- Consumes: giao diện đã có ở Task 12, route `/api/regenerate` và `/api/edit-output` (Task 9)

- [ ] **Step 1: Tạo 1 lượt với ít nhất 2 nhánh** (vd tick 2 giọng văn)

- [ ] **Step 2: Kiểm tra "Sửa tay"**
Bấm "Sửa tay" ở 1 thẻ, sửa nội dung, bấm "Lưu". Xác nhận: thẻ đó hiện nội dung mới, thẻ còn lại không đổi. Tải lại trang (F5) rồi vào lại — vì Task 12 chưa tự load lại run cũ, nội dung trong bộ nhớ trình duyệt sẽ mất (đây là hành vi đúng cho trang chính — lịch sử xem lại nằm ở trang riêng, Task 15).

- [ ] **Step 3: Kiểm tra "Ghi chú, tạo lại"**
Ở thẻ còn lại, gõ ghi chú (vd "ngắn lại"), bấm "Ghi chú, tạo lại". Xác nhận: chỉ thẻ đó chuyển qua "Đang tạo..." rồi ra nội dung mới, thẻ đã sửa tay ở Step 2 không suy chuyển.

- [ ] **Step 4: Kiểm tra thẻ lỗi có nút Thử lại hoạt động**
Nếu có thẻ báo lỗi (vd do chưa cấu hình GreenNode key), bấm "Thử lại" và xác nhận thẻ đó gọi lại đúng 1 lần, không đụng thẻ khác.

- [ ] **Step 5: Không cần commit** (không có thay đổi code ở task này — nếu phát hiện lỗi, quay lại sửa Task 12 và commit ở đó).

---

## Task 14: Trang bảng thuật ngữ

**Files:**
- Create: `src/app/glossary/page.tsx`

**Interfaces:**
- Consumes: `GlossaryRule` (Task 2), API `/api/glossary` (Task 10)

- [ ] **Step 1: Viết `src/app/glossary/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { GlossaryRule } from '@/types'

const BRANCH_LABELS: Record<string, string> = {
  chuyen_nghiep: 'Chuyên nghiệp',
  re_trung: 'Trẻ trung',
  hai: 'Hài',
  viet_anh: 'Việt ↔ Anh',
}

export default function GlossaryPage() {
  const [rules, setRules] = useState<GlossaryRule[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    fetch('/api/glossary')
      .then((res) => res.json())
      .then(setRules)
      .catch(() => setLoadError(true))
  }, [])

  function updateRule(branch: string, field: keyof GlossaryRule, value: string) {
    setRules((prev) => prev?.map((r) => (r.branch === branch ? { ...r, [field]: value } : r)) ?? null)
  }

  async function handleSave() {
    if (!rules) return
    const nextErrors: Record<string, boolean> = {}
    for (const rule of rules) {
      if (!rule.xungHo || !rule.tuVungUuTien || !rule.nhipCau) nextErrors[rule.branch] = true
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setSaveError(false)
    try {
      const res = await fetch('/api/glossary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      })
      if (!res.ok) throw new Error('server_error')
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <p role="alert">
        Không tải được bảng thuật ngữ. <button onClick={() => location.reload()}>Thử lại</button>
      </p>
    )
  }
  if (!rules) return <p>Đang tải...</p>

  return (
    <main>
      <h1>Bảng thuật ngữ</h1>
      {rules.map((rule) => (
        <fieldset key={rule.branch}>
          <legend>{BRANCH_LABELS[rule.branch] ?? rule.branch}</legend>
          {errors[rule.branch] && <p role="alert">Thiếu thông tin bắt buộc cho mục này.</p>}
          <label>
            Xưng hô
            <input value={rule.xungHo} onChange={(e) => updateRule(rule.branch, 'xungHo', e.target.value)} />
          </label>
          <label>
            Từ vựng ưu tiên
            <input
              value={rule.tuVungUuTien}
              onChange={(e) => updateRule(rule.branch, 'tuVungUuTien', e.target.value)}
            />
          </label>
          <label>
            Từ tránh dùng
            <input value={rule.tuTranh} onChange={(e) => updateRule(rule.branch, 'tuTranh', e.target.value)} />
          </label>
          <label>
            Nhịp câu
            <input value={rule.nhipCau} onChange={(e) => updateRule(rule.branch, 'nhipCau', e.target.value)} />
          </label>
          <label>
            Emoji
            <input value={rule.emoji} onChange={(e) => updateRule(rule.branch, 'emoji', e.target.value)} />
          </label>
        </fieldset>
      ))}
      {saveError && <p role="alert">Không lưu được, thử lại sau.</p>}
      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Đang lưu...' : 'Lưu'}
      </button>
    </main>
  )
}
```

- [ ] **Step 2: Chạy dev server, tự kiểm tra bằng tay**
- Mở `/glossary` → thấy 4 mục đã có sẵn dữ liệu mặc định (không trống trơn).
- Xoá trắng ô "Xưng hô" của 1 mục, bấm Lưu → thấy báo đỏ đúng mục đó, chưa lưu được.
- Điền lại, bấm Lưu → không còn báo lỗi. Tắt mở lại `/glossary` → dữ liệu vừa sửa còn nguyên (xác nhận SQLite hoạt động thật).
- Tắt server rồi bấm Lưu → thấy "Không lưu được, thử lại sau.", không phải màn hình trắng hay treo. Bật lại server để tiếp tục.

- [ ] **Step 3: Commit**

```bash
git add src/app/glossary/page.tsx
git commit -m "Build glossary editing page with required-field validation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: Trang lịch sử

**Files:**
- Create: `src/app/history/page.tsx`

**Interfaces:**
- Consumes: `Run` (Task 2), API `/api/history` (Task 11)

- [ ] **Step 1: Viết `src/app/history/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Chạy dev server, tự kiểm tra bằng tay**
- Trước khi tạo lượt nào (hoặc xoá file `data/ted.db` để thử lại từ đầu) → mở `/history` thấy "Chưa có lịch sử...".
- Tạo 1-2 lượt ở trang chính, quay lại `/history` → thấy đủ các lượt, mới nhất ở trên, đúng nội dung từng bản.

- [ ] **Step 3: Commit**

```bash
git add src/app/history/page.tsx
git commit -m "Build history page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 16: Đóng gói Docker + deploy Dokploy + volume lưu trữ

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `next.config.mjs` (bật chế độ `output: 'standalone'` để image gọn hơn — không bắt buộc nhưng khuyến nghị cho Docker)

**Interfaces:**
- Consumes: toàn bộ app đã hoàn chỉnh từ Task 1-15.
- Produces: image Docker chạy được `npm start`, có thể deploy qua Dokploy với volume gắn vào thư mục dữ liệu.

- [ ] **Step 1: Bật `output: standalone` trong `next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 2: Viết `Dockerfile`**

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TED_DATA_DIR=/app/data
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Viết `.dockerignore`**

```
node_modules
.next
data
.env
.git
```

- [ ] **Step 4: Build thử image local để chắc không lỗi**

```bash
docker build -t ted-app .
```
Kỳ vọng: build xong không lỗi.

- [ ] **Step 5: Chạy thử container local**

```bash
docker run -p 3000:3000 -e GREENNODE_API_KEY=xxx -e GREENNODE_BASE_URL=xxx -v ted-data:/app/data ted-app
```
Mở `http://localhost:3000`, xác nhận app chạy được như lúc `npm run dev`.

- [ ] **Step 6: Deploy lên Dokploy**

Dùng skill `deploy-dokploy` (đã cài sẵn) để tạo app trên Dokploy từ repo này. Khi tạo, cấu hình:
- Biến môi trường: `GREENNODE_API_KEY`, `GREENNODE_BASE_URL` (giá trị thật, không commit vào git).
- Một **volume lưu trữ lâu dài** gắn vào đường dẫn `/app/data` (đây là chỗ xử lý rủi ro mất dữ liệu đã ghi trong spec — bắt buộc phải làm ở bước này, không để sau).

- [ ] **Step 7: Kiểm tra toàn bộ checklist từ spec sau khi có link thật**

Chạy đúng danh sách trong spec §8 trên link vừa deploy (không phải localhost):
- Dán gì đó, không tick gì, bấm tạo → bị chặn.
- Tick 1 giọng văn → ra đúng 1 bản.
- Tick cả 3 giọng + Việt-Anh → ra đủ 4 bản.
- Dán hơn 2000 từ → bị chặn.
- Sửa bảng thuật ngữ, lưu → còn nguyên sau khi tải lại trang.
- Tạo vài lượt, xem trang lịch sử → đủ dữ liệu.
- "Ghi chú, tạo lại" 1 bản → chỉ bản đó đổi.
- Rút mạng/tắt tạm GreenNode → thấy lỗi tử tế, không trắng trang.

- [ ] **Step 8: Kiểm tra riêng rủi ro persistent volume**

Sửa bảng thuật ngữ hoặc tạo thêm 1 lượt mới → deploy lại (redeploy) trên Dokploy (không đổi code cũng được, chỉ để kích hoạt lại container) → mở lại link → xác nhận bảng thuật ngữ và lịch sử **vẫn còn**, không bị reset về mặc định. Đây là bằng chứng volume đã gắn đúng.

- [ ] **Step 9: Commit**

```bash
git add Dockerfile .dockerignore next.config.mjs
git commit -m "Add Docker build and Dokploy deployment config with persistent volume

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Sau khi xong tất cả các task

- Chạy lại toàn bộ test tự động: `npm test` — tất cả phải PASS.
- Chạy lại toàn bộ checklist thủ công ở Task 16 Step 7 một lần cuối.
- Merge nhánh `feature/tro-ly-viet-noi-dung` vào `main` — theo CLAUDE.md, chỉ merge khi mọi thứ chạy đúng và bạn đã tự bấm thử.
