import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRun } from '@/lib/runs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const runId = Number(id)
  const db = getDb()
  const run = getRun(db, runId)
  if (!run) {
    return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
  }
  return NextResponse.json(run)
}
