import type Database from 'better-sqlite3'
import { getVariant, getPackage } from '@/lib/generatedContent'
import { getBrief, normalizeBrief } from '@/lib/briefs'
import { getBrandProfile } from '@/lib/brand'
import type { BrandProfile, ContentBrief, ContentVariant, GeneratedContent } from '@/types'

export interface VariantContext {
  variant: ContentVariant
  pkg: GeneratedContent
  brief: ContentBrief
  brand: BrandProfile
}

// Gom lại đúng những gì các thao tác trên 1 biến thể (regenerate/transform/
// quality-check) đều cần: chính biến thể đó, gói chứa nó, brief gốc (hoặc
// brief mặc định nếu gói không gắn brief nào), và Brand Profile hiện hành.
export function loadVariantContext(db: Database.Database, variantId: number): VariantContext | undefined {
  const variant = getVariant(db, variantId)
  if (!variant) return undefined
  const pkg = getPackage(db, variant.generatedContentId)
  if (!pkg) return undefined
  const brief = (pkg.briefId ? getBrief(db, pkg.briefId) : undefined) ?? normalizeBrief({})
  const brand = getBrandProfile(db)
  return { variant, pkg, brief, brand }
}
