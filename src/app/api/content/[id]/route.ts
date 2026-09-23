import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPackage } from '@/lib/generatedContent'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const packageId = Number(id)
  if (!Number.isInteger(packageId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }
  const db = getDb()
  const pkg = getPackage(db, packageId)
  if (!pkg) {
    return NextResponse.json({ error: 'package_not_found' }, { status: 404 })
  }
  return NextResponse.json(pkg)
}
