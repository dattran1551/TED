import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getBrandProfile, updateBrandProfile } from '@/lib/brand'

export async function GET() {
  const db = getDb()
  return NextResponse.json(getBrandProfile(db))
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const db = getDb()
  const updated = updateBrandProfile(db, body)
  return NextResponse.json(updated)
}
