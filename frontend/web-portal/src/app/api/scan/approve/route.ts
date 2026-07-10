import { NextRequest, NextResponse } from 'next/server';

const SCAN_SERVICE = process.env.RECORD_SCAN_PYTHON_URL || 'http://20.198.127.97:8010';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${SCAN_SERVICE}/scan/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'RecordScan service unreachable';
    console.error('[/api/scan/approve] Error:', message);
    return NextResponse.json(
      { detail: `RecordScan service unavailable: ${message}` },
      { status: 503 }
    );
  }
}
