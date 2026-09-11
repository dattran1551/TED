import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { listRuns } from '@/lib/runs'

export async function GET() {
  const db = getDb()
  return NextResponse.json(listRuns(db))
}
