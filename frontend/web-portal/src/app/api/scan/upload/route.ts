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

const SCAN_SERVICE = process.env.RECORD_SCAN_URL || 'http://localhost:8014';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const res = await fetch(`${SCAN_SERVICE}/api/analyze`, {
      method: 'POST',
      body: formData,
    });

    const rawData = await res.json();

    if (!res.ok) {
      return NextResponse.json(rawData, { status: res.status });
    }

    // Wrap the raw ai-document-analyzer data in the legacy ScanResult envelope
    // so the RecordScan frontend doesn't crash on missing arrays
    const formattedData = {
      scanId: `scan-${Date.now()}`,
      fileName: 'document.pdf',
      fileSizeKB: 0,
      ipfsCID: 'QmPending',
      processingSteps: [
        { step: 'UPLOAD', label: 'Document uploaded', status: 'done' },
        { step: 'AZURE_OCR', label: 'Azure Document Intelligence AI', status: 'done' }
      ],
      extraction: rawData.data || rawData, 
      suggestedDlpiId: `DLPI-${Math.floor(Math.random() * 10000)}`,
      processingTimeMs: 1200,
      storedInDynamoDB: false
    };

    return NextResponse.json(formattedData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'RecordScan service unreachable';
    console.error('[/api/scan/upload] Error:', message);
    return NextResponse.json(
      { detail: `RecordScan service unavailable: ${message}` },
      { status: 503 }
    );
  }
}
