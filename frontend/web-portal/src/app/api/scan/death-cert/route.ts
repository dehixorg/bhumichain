import { NextRequest, NextResponse } from 'next/server';

const RECORD_SCAN_URL = process.env.RECORD_SCAN_URL || 'http://localhost:8010';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const res = await fetch(`${RECORD_SCAN_URL}/scan/death-cert`, {
      method: 'POST',
      body: formData,
    });

    const rawData = await res.json();

    if (!res.ok) {
      return NextResponse.json(rawData, { status: res.status });
    }

    return NextResponse.json(rawData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'RecordScan service unreachable';
    console.error('[/api/scan/death-cert] Error:', message);
    return NextResponse.json(
      { detail: `RecordScan service unavailable: ${message}` },
      { status: 503 }
    );
  }
}
