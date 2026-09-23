import type Database from 'better-sqlite3'
import type { BrandProfile, BrandTermRule } from '@/types'
import { isChannelId } from '@/lib/config'
import { DEFAULT_BRAND_PROFILE } from '@/lib/brandDefaults'

const MAX_TEXT_LENGTH = 4000
const MAX_LIST_ITEMS = 50

function cleanString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  return value.trim().slice(0, MAX_TEXT_LENGTH)
}

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, MAX_LIST_ITEMS)
    .map((item) => item.trim().slice(0, 500))
}

function cleanTermRules(value: unknown): BrandTermRule[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      preferred: cleanString(item.preferred).slice(0, 200),
      avoid: typeof item.avoid === 'string' && item.avoid.trim() ? item.avoid.trim().slice(0, 200) : undefined,
    }))
    .filter((item) => item.preferred.length > 0)
    .slice(0, MAX_LIST_ITEMS)
}

function cleanChannelGuidance(value: unknown): BrandProfile['channelGuidance'] {
  if (typeof value !== 'object' || value === null) return {}
  const result: BrandProfile['channelGuidance'] = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (isChannelId(key) && typeof raw === 'string' && raw.trim()) {
      result[key] = raw.trim().slice(0, MAX_TEXT_LENGTH)
    }
  }
  return result
}

// Chuẩn hoá + validate 1 object thô (từ CSDL hoặc từ body request PUT) thành
// BrandProfile hợp lệ, luôn có đủ field kể cả khi input thiếu — field thiếu
// lấy theo mặc định thay vì làm hỏng toàn bộ hồ sơ.
export function normalizeBrandProfile(raw: unknown): BrandProfile {
  const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    brandName: cleanString(input.brandName, DEFAULT_BRAND_PROFILE.brandName),
    brandDescription: cleanString(input.brandDescription, DEFAULT_BRAND_PROFILE.brandDescription),
    voice: cleanString(input.voice, DEFAULT_BRAND_PROFILE.voice),
    tones: cleanStringList(input.tones),
    writingRules: cleanStringList(input.writingRules),
    preferredTerms: cleanTermRules(input.preferredTerms),
    avoidedTerms: cleanStringList(input.avoidedTerms),
    ctaGuidance: cleanString(input.ctaGuidance),
    hashtagGuidance: cleanString(input.hashtagGuidance),
    channelGuidance: cleanChannelGuidance(input.channelGuidance),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : undefined,
  }
}

export function getBrandProfile(db: Database.Database): BrandProfile {
  const row = db.prepare('SELECT data, updated_at FROM brand_profile WHERE id = 1').get() as
    | { data: string; updated_at: string }
    | undefined
  if (!row) return { ...DEFAULT_BRAND_PROFILE }
  try {
    const parsed = normalizeBrandProfile(JSON.parse(row.data))
    return { ...parsed, updatedAt: row.updated_at }
  } catch {
    return { ...DEFAULT_BRAND_PROFILE, updatedAt: row.updated_at }
  }
}

export function updateBrandProfile(db: Database.Database, patch: unknown): BrandProfile {
  const normalized = normalizeBrandProfile(patch)
  // updatedAt do CSDL tự quản (cột updated_at riêng) — không lưu nó lại bên
  // trong JSON "data" để tránh 2 nguồn sự thật lệch nhau.
  const toStore: Omit<BrandProfile, 'updatedAt'> = {
    brandName: normalized.brandName,
    brandDescription: normalized.brandDescription,
    voice: normalized.voice,
    tones: normalized.tones,
    writingRules: normalized.writingRules,
    preferredTerms: normalized.preferredTerms,
    avoidedTerms: normalized.avoidedTerms,
    ctaGuidance: normalized.ctaGuidance,
    hashtagGuidance: normalized.hashtagGuidance,
    channelGuidance: normalized.channelGuidance,
  }
  db.prepare(
    `INSERT INTO brand_profile (id, data, updated_at) VALUES (1, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(JSON.stringify(toStore))
  return getBrandProfile(db)
}
