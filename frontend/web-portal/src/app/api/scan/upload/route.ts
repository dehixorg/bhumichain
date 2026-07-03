/**
 * Next.js API proxy: POST /api/scan/upload
 *
 * Forwards the multipart form data to the RecordScan AI service running
 * on localhost:8010 (same VM, internal network). This avoids the browser
 * having to reach port 8010 directly (which would be blocked by Azure NSG).
 *
 * Browser → /api/scan/upload (Next.js, port 3000) → localhost:8010/scan/upload
 */

import { NextRequest, NextResponse } from 'next/server';

const SCAN_SERVICE = process.env.RECORD_SCAN_URL || 'http://localhost:8010';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Forward the same multipart payload to the RecordScan service
    const res = await fetch(`${SCAN_SERVICE}/scan/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'RecordScan service unreachable';
    console.error('[/api/scan/upload] Error:', message);
    return NextResponse.json(
      { detail: `RecordScan service unavailable: ${message}` },
      { status: 503 }
    );
  }
}
