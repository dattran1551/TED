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
