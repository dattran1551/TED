# Bỏ Bảng thuật ngữ, để AI tự quyết giọng văn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (thực thi tại chỗ, task-by-task, TDD).

**Goal:** Xoá hoàn toàn cơ chế Bảng thuật ngữ (trang, API, bảng CSDL, code liên quan) để đơn giản hoá app — AI chỉ nhận tên giọng văn (Chuyên nghiệp/Trẻ trung/Hài) và tự quyết định cách viết, không còn bị ép xưng hô/từ vựng/nhịp câu/emoji theo quy tắc cứng.

**Architecture:** `buildPrompt`/`buildRegeneratePrompt` bỏ tham số `rule: GlossaryRule`, chỉ còn `inputText` + `branch` (+ `note` với regenerate). 3 route (`generate`, `regenerate`, `translate`) bỏ bước tra `getGlossary`/kiểm tra thiếu quy tắc. Toàn bộ subsystem glossary (lib, route, trang, bảng CSDL, type) bị xoá.

**Tech Stack:** Không đổi so với trước (Next.js App Router, better-sqlite3, Vitest).

**Spec:** Không có file spec riêng — quyết định chốt trực tiếp qua hội thoại (đã hỏi rõ 3 câu: lý do bỏ, mức giữ khác biệt giọng văn, cách xử lý thuật ngữ khi dịch). Người dùng đã xác nhận chấp nhận rủi ro "3 giọng văn / bản dịch có thể kém khác biệt/kém chính xác hơn trước" để đổi lấy đơn giản hoá.

## Global Constraints

- Không đổi hành vi 2 nhánh dịch về mặt CƠ CHẾ (vẫn dịch từ bản gốc đã chọn, vẫn giữ bố cục) — chỉ bỏ phần "giữ nguyên thuật ngữ game không dịch".
- File CSDL cũ (đã có bảng `glossary_rules` từ trước) phải mở lại được bình thường, không lỗi, không cần xoá tay `data/ted.db` — bảng cũ cứ để nguyên đó, không dùng tới nữa, không viết migration xoá bảng (tránh thao tác phá huỷ không cần thiết trên dữ liệu đã triển khai).
- Không còn cách nào (route/trang) để đọc hoặc sửa `glossary_rules` sau khi xong — API và trang bị xoá hẳn, không chỉ ẩn đi.
- Làm trên nhánh git `feature/tro-ly-viet-noi-dung` hiện tại — không tạo nhánh mới, không đụng `main`.

---

## Task 1: Đơn giản hoá promptBuilder — bỏ tham số rule

**Files:**
- Modify: `src/lib/promptBuilder.ts`
- Modify: `src/lib/promptBuilder.test.ts`

**Interfaces:**
- Consumes: `Branch`, `TranslateTarget`, `BRANCH_LABELS` (từ `@/types`, không đổi)
- Produces: `buildPrompt(inputText: string, branch: Branch): string`; `buildRegeneratePrompt(inputText: string, branch: Branch, note: string): string` — CẢ HAI bỏ hẳn tham số `rule`.

- [ ] **Step 1: Sửa test trước — thay toàn bộ nội dung `src/lib/promptBuilder.test.ts` bằng**

```typescript
import { describe, it, expect } from 'vitest'
import { buildPrompt, buildRegeneratePrompt } from './promptBuilder'

describe('buildPrompt', () => {
  it('với giọng văn thường: chứa nội dung gốc và tên giọng văn thật', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai')
    expect(prompt).toContain('Bản 2.5 ra mắt thứ Sáu.')
    expect(prompt).toContain('giọng văn: Hài.')
  })

  it('với giọng văn thường: dặn AI tự nhận diện loại nội dung và viết đúng bố cục chuẩn', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai')
    expect(prompt).toContain('nhận diện')
    expect(prompt).toContain('bố cục chuẩn')
  })

  it('với nhánh dich_anh: dùng câu lệnh dịch sang tiếng Anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_anh')
    expect(prompt).toContain('dịch sang tiếng Anh')
    expect(prompt).not.toContain('tiếng Hoa')
  })

  it('với nhánh dich_hoa: dùng câu lệnh dịch sang tiếng Hoa, khác dich_anh', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_hoa')
    expect(prompt).toContain('dịch sang tiếng Hoa')
    expect(prompt).not.toContain('tiếng Anh')
  })

  it('với bản dịch: dặn AI giữ nguyên bố cục/xuống dòng của bản gốc, chỉ dịch ngôn ngữ', () => {
    const prompt = buildPrompt('Bản 2.5 ra mắt thứ Sáu.', 'dich_anh')
    expect(prompt).toContain('Giữ nguyên bố cục')
  })
})

describe('buildRegeneratePrompt', () => {
  it('nối thêm ghi chú điều chỉnh vào cuối prompt gốc', () => {
    const prompt = buildRegeneratePrompt('Bản 2.5 ra mắt thứ Sáu.', 'hai', 'hài hơn nữa')
    expect(prompt).toContain('hài hơn nữa')
    expect(prompt.indexOf('Ghi chú điều chỉnh')).toBeGreaterThan(prompt.indexOf('Bản 2.5 ra mắt thứ Sáu.'))
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail** (vì `buildPrompt` hiện vẫn bắt buộc 3 tham số)

```bash
npx vitest run src/lib/promptBuilder.test.ts
```

- [ ] **Step 3: Sửa `src/lib/promptBuilder.ts` — thay toàn bộ nội dung bằng**

```typescript
import { BRANCH_LABELS } from '@/types'
import type { Branch, TranslateTarget } from '@/types'

const TRANSLATE_TARGET_LANGUAGE: Record<TranslateTarget, string> = {
  dich_anh: 'tiếng Anh',
  dich_hoa: 'tiếng Hoa (chữ Giản thể)',
}

function isTranslateTarget(branch: Branch): branch is TranslateTarget {
  return branch === 'dich_anh' || branch === 'dich_hoa'
}

export function buildPrompt(inputText: string, branch: Branch): string {
  if (isTranslateTarget(branch)) {
    const language = TRANSLATE_TARGET_LANGUAGE[branch]
    return [
      `Bạn là trợ lý dịch nội dung sang ${language}.`,
      'Giữ nguyên bố cục, cách xuống dòng và cấu trúc của bản gốc — chỉ dịch ngôn ngữ, không thay đổi cấu trúc.',
      '',
      'Nội dung gốc:',
      inputText,
      '',
      `Hãy dịch sang ${language}, chỉ trả về bản dịch, không thêm giải thích.`,
    ].join('\n')
  }

  return [
    `Bạn là trợ lý viết lại nội dung theo giọng văn: ${BRANCH_LABELS[branch]}.`,
    'Trước tiên, hãy tự nhận diện người dùng đang muốn tạo ra loại nội dung thực tế gì (ví dụ: bài đăng mạng xã hội, thông báo nội bộ công ty, email, tin nhắn...) dựa vào chính nội dung/yêu cầu bên dưới.',
    'Sau đó viết đúng theo bố cục chuẩn ngoài đời thật của loại nội dung đó (ví dụ: bài đăng mạng xã hội cần câu mở đầu thu hút, xuống dòng tách từng ý, có thể kèm hashtag; thông báo nội bộ cần tiêu đề và bố cục trang trọng, rõ ràng) — không gộp mọi thứ thành một đoạn văn xuôi liền mạch nếu loại nội dung đó không viết như vậy ngoài đời thật.',
    'Tự quyết định cách xưng hô, từ ngữ, nhịp câu và có dùng emoji hay không sao cho đúng chất giọng văn đã nêu ở trên, miễn là nhất quán và rõ ràng khác với các giọng văn khác.',
    '',
    'Nội dung gốc:',
    inputText,
    '',
    'Hãy viết lại theo đúng các quy tắc trên. Chỉ trả về bản viết lại, không thêm giải thích.',
  ].join('\n')
}

export function buildRegeneratePrompt(inputText: string, branch: Branch, note: string): string {
  return buildPrompt(inputText, branch) + `\n\nGhi chú điều chỉnh thêm từ người dùng: ${note}`
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/lib/promptBuilder.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/promptBuilder.ts src/lib/promptBuilder.test.ts
git commit -m "Bỏ tham số rule khỏi promptBuilder, để AI tự quyết cách viết

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Sẽ có lỗi kiểu dữ liệu ở 3 route gọi `buildPrompt`/`buildRegeneratePrompt` cho tới khi Task 2-4 xong — bình thường.)

---

## Task 2: Đơn giản hoá route generate — bỏ tra cứu glossary

**Files:**
- Modify: `src/app/api/generate/route.ts`
- Modify: `src/app/api/generate/route.test.ts`

**Interfaces:**
- Consumes: `buildPrompt(inputText, branch)` (Task 1, không còn `rule`)
- Produces: route không còn tra `getGlossary`, không còn nhánh lỗi "Thiếu bảng thuật ngữ cho nhánh này" — mọi nhánh đều được gọi AI trực tiếp.

- [ ] **Step 1: Sửa test trước — thay toàn bộ nội dung `src/app/api/generate/route.test.ts` bằng**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDb } from '@/lib/db'
import { getRun } from '@/lib/runs'
import { waitForRun } from '@/lib/pendingRuns'
import { BRANCH_LABELS } from '@/types'
import type { Run } from '@/types'

const testDb = createDb(':memory:')

const writeFailure = vi.hoisted(() => ({ branch: null as string | null }))

const aiControl = vi.hoisted(() => ({
  failMarkers: [] as string[],
  gate: null as null | { promise: Promise<void>; release: () => void },
}))

function openGate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  aiControl.gate = { promise, release }
  return () => aiControl.gate?.release()
}

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return { ...actual, getDb: () => testDb }
})

vi.mock('@/lib/qwenClient', () => ({
  callQwen: vi.fn(async (prompt: string) => {
    if (aiControl.gate) await aiControl.gate.promise
    if (aiControl.failMarkers.some((marker) => prompt.includes(marker))) {
      throw new Error('lỗi giả lập')
    }
    return 'bản viết lại giả lập'
  }),
}))

vi.mock('@/lib/runs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/runs')>()
  return {
    ...actual,
    saveOutputResult: (db: any, outputId: number, result: any) => {
      const row = db.prepare('SELECT branch FROM run_outputs WHERE id = ?').get(outputId) as
        | { branch: string }
        | undefined
      if (row && writeFailure.branch && row.branch === writeFailure.branch) {
        throw new Error('lỗi ghi DB giả lập')
      }
      return actual.saveOutputResult(db, outputId, result)
    },
  }
})

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const HAI_MARKER = `giọng văn: ${BRANCH_LABELS.hai}`
const RE_TRUNG_MARKER = `giọng văn: ${BRANCH_LABELS.re_trung}`

async function settledRun(runId: number) {
  await waitForRun(runId)
  return getRun(testDb, runId)!
}

beforeEach(() => {
  testDb.exec('DELETE FROM run_outputs; DELETE FROM runs;')
})

afterEach(async () => {
  aiControl.gate?.release()
  aiControl.gate = null
  aiControl.failMarkers = []
  writeFailure.branch = null
})

describe('POST /api/generate', () => {
  it('trả 400 khi không có tuỳ chọn nào được chọn', async () => {
    const res = await POST(makeRequest({ inputText: 'xin chào', options: { tones: [] } }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('no_options')
  })

  it('sinh đủ số bản theo tuỳ chọn, mỗi bản có nội dung', async () => {
    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    expect(created.outputs).toHaveLength(2)

    const run = await settledRun(created.id)
    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o) => o.status === 'success')).toBe(true)
  })

  it('trả về NGAY, mọi nhánh còn pending, không chờ nhánh nào xong', async () => {
    const release = openGate()

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    const created: Run = await res.json()

    expect(res.status).toBe(200)
    expect(created.outputs).toHaveLength(2)
    expect(created.outputs.every((o) => o.status === 'pending')).toBe(true)
    expect(getRun(testDb, created.id)!.outputs.every((o) => o.status === 'pending')).toBe(true)

    release()
    const run = await settledRun(created.id)
    expect(run.outputs.every((o) => o.status === 'success')).toBe(true)
  })

  it('một nhánh lỗi AI KHÔNG kéo nhánh còn lại lỗi theo', async () => {
    aiControl.failMarkers = [HAI_MARKER]

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    const created = await res.json()
    const run = await settledRun(created.id)

    const hai = run.outputs.find((o) => o.branch === 'hai')!
    const reTrung = run.outputs.find((o) => o.branch === 're_trung')!
    expect(hai.status).toBe('error')
    expect(hai.errorMessage).toBe('lỗi giả lập')
    expect(reTrung.status).toBe('success')
    expect(reTrung.content).toBe('bản viết lại giả lập')
  })

  it('cả hai nhánh cùng lỗi thì request vẫn không sập, vẫn đủ output', async () => {
    aiControl.failMarkers = [HAI_MARKER, RE_TRUNG_MARKER]

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    const run = await settledRun(created.id)

    expect(run.outputs).toHaveLength(2)
    expect(run.outputs.every((o) => o.status === 'error')).toBe(true)
  })

  it('lỗi ghi DB ở nhánh thành công không làm hỏng cả request lẫn nhánh còn lại', async () => {
    writeFailure.branch = 'hai'

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    const run = await settledRun(created.id)
    expect(run.outputs).toHaveLength(2)

    const haiOutput = run.outputs.find((o) => o.branch === 'hai')!
    const otherOutput = run.outputs.find((o) => o.branch === 're_trung')!

    expect(haiOutput.status).toBe('pending')
    expect(otherOutput.status).toBe('success')
    expect(otherOutput.content).toBe('bản viết lại giả lập')
  })

  it('lỗi ghi DB khi lưu kết quả lỗi (nhánh catch) không làm hỏng nhánh còn lại', async () => {
    aiControl.failMarkers = [HAI_MARKER, RE_TRUNG_MARKER]
    writeFailure.branch = 'hai'

    const res = await POST(
      makeRequest({ inputText: 'xin chào', options: { tones: ['hai', 're_trung'] } })
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    const run = await settledRun(created.id)
    expect(run.outputs).toHaveLength(2)

    const haiOutput = run.outputs.find((o) => o.branch === 'hai')!
    const otherOutput = run.outputs.find((o) => o.branch === 're_trung')!

    expect(haiOutput.status).toBe('pending')
    expect(otherOutput.status).toBe('error')
  })
})
```

(2 test cũ về "thiếu bảng thuật ngữ" bị bỏ hẳn — tình huống đó không còn tồn tại được nữa vì route không tra glossary.)

- [ ] **Step 2: Chạy test, xác nhận fail** (vì route hiện vẫn gọi `buildPrompt(inputText, output.branch, rule)` 3 tham số, và `promptBuilder.ts` giờ chỉ nhận 2 → lỗi biên dịch/kiểu)

```bash
npx vitest run src/app/api/generate/route.test.ts
```

- [ ] **Step 3: Sửa `src/app/api/generate/route.ts` — thay toàn bộ nội dung bằng**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createRun, saveOutputResult } from '@/lib/runs'
import { trackRun } from '@/lib/pendingRuns'
import { validateInput } from '@/lib/validation'
import { buildPrompt } from '@/lib/promptBuilder'
import { callQwen } from '@/lib/qwenClient'
import type { Branch, GenerateOptions } from '@/types'

// Wraps saveOutputResult so a DB-write failure for one output can never
// reject the outer Promise.all and take down the sibling branches.
function safeSaveOutputResult(
  db: ReturnType<typeof getDb>,
  outputId: number,
  result: Parameters<typeof saveOutputResult>[2]
) {
  try {
    saveOutputResult(db, outputId, result)
  } catch (writeErr) {
    console.error(`Failed to save output ${outputId}:`, writeErr)
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const inputText: string = body.inputText ?? ''
  const options: GenerateOptions = body.options ?? { tones: [] }

  const validation = validateInput(inputText, options)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  const db = getDb()
  const branches: Branch[] = [...options.tones]

  const run = createRun(db, inputText, options, branches)

  // KHÔNG await: mỗi nhánh tự chạy và tự ghi kết quả của mình vào CSDL. Nhờ
  // vậy màn hình nhận được lượt vừa tạo (mọi nhánh còn 'pending') ngay lập
  // tức, rồi hỏi lại /api/runs/{id} để từng thẻ sáng lên đúng lúc nhánh đó
  // xong — thay vì phải chờ nhánh chậm nhất rồi mới hiện tất cả cùng lúc.
  const work = Promise.all(
    run.outputs.map(async (output) => {
      try {
        const content = await callQwen(buildPrompt(inputText, output.branch))
        saveOutputResult(db, output.id, { status: 'success', content })
      } catch (err) {
        safeSaveOutputResult(db, output.id, { status: 'error', errorMessage: (err as Error).message })
      }
    })
  ).then(() => undefined)

  trackRun(run.id, work)
  // Từng nhánh đã tự bọc try/catch nên chỗ này gần như không bao giờ chạy —
  // nhưng vẫn phải có, để một lỗi ngoài dự tính không thành unhandled rejection.
  work.catch((err) => {
    console.error(`Lỗi ngoài dự tính khi sinh nội dung nền cho lượt ${run.id}:`, err)
  })

  return NextResponse.json(run)
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

```bash
npx vitest run src/app/api/generate/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate/route.ts src/app/api/generate/route.test.ts
git commit -m "Bỏ tra cứu bảng thuật ngữ khỏi route generate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Đơn giản hoá route regenerate — bỏ tra cứu glossary

**Files:**
- Modify: `src/app/api/regenerate/route.ts`

**Interfaces:**
- Consumes: `buildRegeneratePrompt(inputText, branch, note)` (Task 1, không còn `rule`)
- Produces: route không còn tra `getGlossary`, không còn trả lỗi `glossary_missing`.

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/app/api/regenerate/route.ts` để lấy đúng nội dung đang có.

- [ ] **Step 2: Sửa `src/app/api/regenerate/route.ts` — thay toàn bộ nội dung bằng**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
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

  // Với nhánh dịch (có sourceOutputId), phải dịch lại từ ĐÚNG bản giọng văn đã
  // chọn (có thể đã được sửa tay), không phải từ câu nhập gốc của cả lượt.
  let baseText = run.inputText
  if (output.sourceOutputId !== null) {
    const source = run.outputs.find((o) => o.id === output.sourceOutputId)
    baseText = source?.editedContent ?? source?.content ?? run.inputText
  }

  saveRegenerateNote(db, outputId, note)

  try {
    const content = await callQwen(buildRegeneratePrompt(baseText, output.branch, note))
    saveOutputResult(db, outputId, { status: 'success', content })
  } catch (err) {
    saveOutputResult(db, outputId, { status: 'error', errorMessage: (err as Error).message })
  }

  const finalRun = getRun(db, runId)
  return NextResponse.json(finalRun)
}
```

- [ ] **Step 3: Chạy test, xác nhận pass** (test file này không kiểm tra glossary trực tiếp nên không cần sửa, chỉ cần route biên dịch đúng và hành vi giữ nguyên)

```bash
npx vitest run src/app/api/regenerate/route.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/regenerate/route.ts
git commit -m "Bỏ tra cứu bảng thuật ngữ khỏi route regenerate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Đơn giản hoá route translate — bỏ tra cứu glossary

**Files:**
- Modify: `src/app/api/translate/route.ts`

**Interfaces:**
- Consumes: `buildPrompt(inputText, branch)` (Task 1)
- Produces: route không còn tra `getGlossary`, không còn trả lỗi `glossary_missing`.

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/app/api/translate/route.ts` để lấy đúng nội dung đang có.

- [ ] **Step 2: Sửa `src/app/api/translate/route.ts` — thay toàn bộ nội dung bằng**

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
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

  const sourceText = source.editedContent ?? source.content ?? ''

  // Nếu đã dịch nhánh này từ trước (vd bấm lại), dùng lại đúng bản ghi cũ thay
  // vì tạo thêm 1 thẻ trùng lặp cho cùng ngôn ngữ.
  const existing = run.outputs.find((o) => o.branch === targetBranch && o.sourceOutputId === sourceOutputId)
  const output = existing ?? addOutput(db, runId, targetBranch, sourceOutputId)

  try {
    const content = await callQwen(buildPrompt(sourceText, targetBranch))
    saveOutputResult(db, output.id, { status: 'success', content })
  } catch (err) {
    saveOutputResult(db, output.id, { status: 'error', errorMessage: (err as Error).message })
  }

  const finalRun = getRun(db, runId)
  return NextResponse.json(finalRun)
}
```

- [ ] **Step 3: Chạy test, xác nhận pass**

```bash
npx vitest run src/app/api/translate/route.test.ts
```

- [ ] **Step 4: Chạy toàn bộ suite để chắc 4 task đầu ăn khớp nhau**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

Kỳ vọng: sạch, không lỗi. (Thư viện/route/trang glossary ở Task 5 chưa đụng tới
nhưng vẫn tự biên dịch đúng bình thường ở bước này — chúng độc lập với
`promptBuilder.ts`, chỉ là code thừa sẽ bị xoá ở Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/translate/route.ts
git commit -m "Bỏ tra cứu bảng thuật ngữ khỏi route translate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Xoá trang, API, và thư viện Bảng thuật ngữ

**Files:**
- Delete: `src/app/glossary/page.tsx`
- Delete: `src/app/api/glossary/route.ts`
- Delete: `src/app/api/glossary/route.test.ts`
- Delete: `src/lib/glossary.ts`
- Delete: `src/lib/glossary.test.ts`
- Modify: `src/components/Nav.tsx`

**Interfaces:**
- Consumes: không có
- Produces: không còn route `/glossary`, không còn API `/api/glossary`, không còn hàm `getGlossary`/`getGlossaryRule`/`updateGlossaryRule` ở đâu trong codebase.

- [ ] **Step 1: Xoá 5 file**

```bash
git rm src/app/glossary/page.tsx src/app/api/glossary/route.ts src/app/api/glossary/route.test.ts src/lib/glossary.ts src/lib/glossary.test.ts
```

- [ ] **Step 2: Sửa `src/components/Nav.tsx` — bỏ dòng link "Bảng thuật ngữ"**

Tìm mảng `LINKS`:
```typescript
const LINKS = [
  { href: '/', label: 'Trang chính' },
  { href: '/glossary', label: 'Bảng thuật ngữ' },
  { href: '/history', label: 'Lịch sử' },
]
```
Đổi thành:
```typescript
const LINKS = [
  { href: '/', label: 'Trang chính' },
  { href: '/history', label: 'Lịch sử' },
]
```

- [ ] **Step 3: Chạy toàn bộ test, xác nhận không còn test nào tham chiếu tới các file đã xoá**

```bash
npx vitest run --exclude '**/.worktrees/**'
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Xoá trang, API và thư viện Bảng thuật ngữ

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Đơn giản hoá CSDL — bỏ bảng glossary_rules

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: không có
- Produces: `createDb(dbPath)` không còn tạo/seed bảng `glossary_rules`; không còn export `DEFAULT_GLOSSARY`. Mở lại 1 file CSDL cũ (đã có bảng `glossary_rules` từ trước) vẫn không lỗi — bảng cũ bị bỏ mặc, không đụng tới.

- [ ] **Step 1: Sửa test trước — thay toàn bộ nội dung `src/lib/db.test.ts` bằng**

```typescript
import { describe, it, expect } from 'vitest'
import { createDb } from './db'

describe('createDb', () => {
  it('tạo đủ 2 bảng runs và run_outputs', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['runs', 'run_outputs']))
    db.close()
  })

  it('run_outputs có cột source_output_id', () => {
    const db = createDb(':memory:')
    const columns = db.prepare('PRAGMA table_info(run_outputs)').all() as { name: string }[]
    expect(columns.some((c) => c.name === 'source_output_id')).toBe(true)
    db.close()
  })

  it('mở lại 1 file CSDL giữa các lần chạy vẫn giữ nguyên dữ liệu đã có', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const tmpPath = path.join(os.tmpdir(), `ted-test-persist-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    const db1 = createDb(tmpPath)
    db1.prepare("INSERT INTO runs (input_text, options_json) VALUES ('nội dung mẫu', '{}')").run()
    db1.close()

    const db2 = createDb(tmpPath)
    const row = db2.prepare('SELECT input_text FROM runs').get() as any
    expect(row.input_text).toBe('nội dung mẫu')

    db2.close()
    fs.unlinkSync(tmpPath)
  })

  it('mở lại 1 file CSDL cũ (còn bảng glossary_rules từ trước khi bỏ tính năng) vẫn mở được bình thường', () => {
    const os = require('node:os')
    const path = require('node:path')
    const fs = require('node:fs')
    const RawDatabase = require('better-sqlite3')
    const tmpPath = path.join(
      os.tmpdir(),
      `ted-test-oldschema-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    )

    const oldDb = new RawDatabase(tmpPath)
    oldDb.exec(`
      CREATE TABLE glossary_rules (branch TEXT PRIMARY KEY, xung_ho TEXT, tu_vung_uu_tien TEXT, tu_tranh TEXT, nhip_cau TEXT, emoji TEXT);
      INSERT INTO glossary_rules (branch, xung_ho, tu_vung_uu_tien, tu_tranh, nhip_cau, emoji) VALUES ('hai', 'x', 'y', 'z', 'w', 'v');
    `)
    oldDb.close()

    const db = createDb(tmpPath)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['runs', 'run_outputs']))
    // Bảng cũ vẫn còn nguyên đó (không xoá, không đụng tới) — chỉ là app
    // không còn dùng tới nó nữa.
    expect(tables).toContain('glossary_rules')

    db.close()
    fs.unlinkSync(tmpPath)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail** (test đầu tiên fail vì bảng `glossary_rules` vẫn được tạo, có mặt trong danh sách `tables`... thực ra `toEqual(expect.arrayContaining(...))` không fail vì thừa bảng — nhưng để chắc chắn có fail thật, chạy trước khi sửa code để xác nhận toàn bộ suite chạy được, sau đó Step 3 mới là thay đổi thật)

```bash
npx vitest run src/lib/db.test.ts
```

Ghi chú: nếu bước này PASS ngay cả khi chưa sửa `db.ts` (vì bảng thừa không làm fail `arrayContaining`), vẫn tiếp tục Step 3 bình thường — mục tiêu của task là bỏ code tạo bảng, không phải để test tự fail bằng mọi giá.

- [ ] **Step 3: Sửa `src/lib/db.ts` — thay toàn bộ nội dung bằng**

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

function migrateRunOutputsSchema(db: Database.Database) {
  const columns = db.prepare('PRAGMA table_info(run_outputs)').all() as { name: string }[]
  const hasSourceOutputId = columns.some((c) => c.name === 'source_output_id')
  if (!hasSourceOutputId) {
    db.exec('ALTER TABLE run_outputs ADD COLUMN source_output_id INTEGER REFERENCES run_outputs(id)')
  }
}

export function createDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  // SQLite mặc định TẮT kiểm tra khoá ngoại, nên ràng buộc run_outputs.run_id
  // -> runs(id) khai báo ở dưới sẽ không có tác dụng nếu không bật dòng này.
  db.pragma('foreign_keys = ON')
  db.exec(`
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
git commit -m "Bỏ bảng glossary_rules khỏi CSDL, giữ tương thích file cũ

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Bỏ GlossaryRule khỏi types.ts

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: không có
- Produces: `types.ts` không còn export `GlossaryRule`.

- [ ] **Step 1: Đọc file hiện tại**

Đọc `src/types.ts` để lấy đúng nội dung đang có.

- [ ] **Step 2: Xoá khối `GlossaryRule`**

Xoá đoạn:
```typescript
export interface GlossaryRule {
  branch: Branch
  xungHo: string
  tuVungUuTien: string
  tuTranh: string
  nhipCau: string
  emoji: string
}
```

Không sửa gì khác trong file.

- [ ] **Step 3: Kiểm tra không còn nơi nào import `GlossaryRule`**

```bash
npx tsc --noEmit
```

Kỳ vọng: sạch, không lỗi (nếu còn lỗi báo thiếu `GlossaryRule` ở file nào, đó là dấu hiệu Task 1-6 chưa dọn hết — quay lại file đó xử lý trước khi tiếp tục).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "Bỏ type GlossaryRule không còn dùng tới

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Dọn CSS chết của trang Bảng thuật ngữ

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:** không có (thuần CSS, không ai import các class này nữa sau Task 5)

- [ ] **Step 1: Xoá khối CSS của trang glossary**

Tìm và xoá toàn bộ đoạn (từ dòng comment `/* ------------------------------ Glossary page --------------------------- */` cho tới hết `.glossary-card legend { ... }`):

```css
/* ------------------------------ Glossary page --------------------------- */
.glossary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

.glossary-card {
  --accent: var(--ink-faint);
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-top: 3px solid var(--accent);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-card);
}

.glossary-card[data-branch="chuyen_nghiep"] {
  --accent: var(--tone-chuyen-nghiep);
}
.glossary-card[data-branch="re_trung"] {
  --accent: var(--tone-re-trung);
}
.glossary-card[data-branch="hai"] {
  --accent: var(--tone-hai);
}
.glossary-card[data-branch="dich_anh"] {
  --accent: var(--tone-dich-anh);
}
.glossary-card[data-branch="dich_hoa"] {
  --accent: var(--tone-dich-hoa);
}

.glossary-card legend {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 1.05rem;
  margin-bottom: var(--space-1);
}
```

- [ ] **Step 2: Xoá khối `.field`/`.field-label`** (chỉ dùng trong trang glossary đã xoá)

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}
```

- [ ] **Step 3: Xoá class `.status`** (chỉ dùng trong trang glossary đã xoá — tìm và xoá đúng khối)

```css
.status {
  color: var(--tone-dich-anh);
  font-size: 0.9rem;
}
```

- [ ] **Step 4: Xác nhận bằng grep không còn tham chiếu nào tới các class vừa xoá trong `src/`**

```bash
grep -rn "glossary-grid\|glossary-card\|\"field\"\|field-label\|className=\"status\"" src/
```

Kỳ vọng: không có kết quả nào.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "Dọn CSS chết của trang Bảng thuật ngữ đã xoá

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Cập nhật README, kiểm tra toàn bộ, xác minh qua trình duyệt thật

**Files:**
- Modify: `README.md`

**Interfaces:** không có

- [ ] **Step 1: Sửa `README.md` — thay đoạn mô tả và danh sách màn hình**

Tìm:
```markdown
Dán một đoạn nội dung vào, chọn giọng văn muốn có (Chuyên nghiệp, Trẻ trung,
Hài) và/hoặc bật dịch Việt ↔ Anh. Ứng dụng gọi model Qwen 3.0 qua GreenNode cho
từng nhánh song song, mỗi nhánh dùng chung một bảng thuật ngữ mà bạn tự sửa
được. Kết quả hiện thành từng thẻ riêng: sửa tay được, ghi chú để tạo lại được,
và mọi lượt đều lưu lại trong lịch sử.

Ba màn hình:

- `/` — nhập nội dung và xem kết quả
- `/glossary` — sửa bảng thuật ngữ dùng chung cho các nhánh
- `/history` — xem lại các lượt đã tạo
```

Đổi thành:
```markdown
Dán một đoạn nội dung/yêu cầu vào, chọn giọng văn muốn có (Chuyên nghiệp, Trẻ
trung, Hài). Ứng dụng gọi AI qua GreenNode cho từng nhánh song song, để AI tự
quyết định cách viết đúng chất giọng văn đã chọn. Sau khi có kết quả, chọn 1
bản để dịch tiếp sang Tiếng Anh hoặc Tiếng Hoa. Kết quả hiện thành từng thẻ
riêng: sửa tay được, ghi chú để tạo lại được, và mọi lượt đều lưu lại trong
lịch sử.

Hai màn hình:

- `/` — nhập nội dung, xem kết quả, chọn bản để dịch tiếp
- `/history` — xem lại các lượt đã tạo
```

- [ ] **Step 2: Chạy toàn bộ test + kiểm tra kiểu dữ liệu**

```bash
npx tsc --noEmit
npx vitest run --exclude '**/.worktrees/**'
```

Kỳ vọng: sạch, không lỗi.

- [ ] **Step 3: Tự kiểm tra bằng tay qua trình duyệt thật** (khởi động lại dev server để chắc không dính bản build cũ)
  - Thanh điều hướng KHÔNG còn "Bảng thuật ngữ".
  - Vào thẳng `http://localhost:3000/glossary` → phải ra trang 404 (route không còn tồn tại).
  - Tạo nội dung với cả 3 giọng văn → cả 3 vẫn ra kết quả, đọc thử để cảm nhận có còn khác nhau rõ hay không (chấp nhận có thể kém rõ hơn trước, đây là đánh đổi đã biết trước).
  - Chọn 1 bản, dịch sang Tiếng Anh và Tiếng Hoa → vẫn hoạt động bình thường.
  - Bấm "Ghi chú, tạo lại" trên 1 bản → vẫn hoạt động bình thường.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Cập nhật README: bỏ mô tả Bảng thuật ngữ, đúng model đang dùng

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
