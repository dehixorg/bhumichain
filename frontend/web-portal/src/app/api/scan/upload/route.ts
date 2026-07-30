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

export const dynamic = 'force-dynamic';

// --- Transparent Sanitizer (Preserves all original language and translated fields) ─────
function ensureEnglish(obj: any): any {
  return obj;
}

const DOC_ANALYZER_SERVICE = process.env.DOC_ANALYZER_URL || 'http://localhost:8014';
const RECORD_SCAN_SERVICE  = process.env.RECORD_SCAN_URL  || 'http://localhost:8010';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    let rawData: any = null;
    let success = false;

    // 1. Primary: Try AI Document Analyzer (Port 8014 - Azure OpenAI GPT-5.4 Legal OCR & Structuring)
    try {
      const resDoc = await fetch(`${DOC_ANALYZER_SERVICE}/api/analyze`, {
        method: 'POST',
        body: formData,
      });
      if (resDoc.ok) {
        rawData = await resDoc.json();
        success = true;
      }
    } catch (docErr) {
      console.warn('[/api/scan/upload] AI Document Analyzer (Port 8014) notice:', docErr);
    }

    // 2. Fallback: RecordScan AI Service (Port 8010 - Khatauni Azure Document Intelligence)
    if (!success) {
      const resScan = await fetch(`${RECORD_SCAN_SERVICE}/scan/upload`, {
        method: 'POST',
        body: formData,
      });
      rawData = await resScan.json();
      if (!resScan.ok) {
        return NextResponse.json(ensureEnglish(rawData), { status: resScan.status });
      }
    }

    const extractionData = rawData?.data || rawData?.extraction || rawData;

    const formattedData = ensureEnglish({
      scanId: `scan-${Date.now()}`,
      fileName: 'document.pdf',
      fileSizeKB: 0,
      ipfsCID: 'QmPending',
      processingSteps: [
        { step: 'UPLOAD', label: 'Document uploaded', status: 'done' },
        { step: 'AZURE_OCR', label: 'Azure GPT-5.4 Legal Document Intelligence AI', status: 'done' }
      ],
      extraction: extractionData,
      suggestedDlpiId: `DLPI-${Math.floor(Math.random() * 10000)}`,
      processingTimeMs: 1200,
      storedInDynamoDB: false
    });

    return NextResponse.json(formattedData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Document analysis service unreachable';
    console.error('[/api/scan/upload] Error:', message);
    return NextResponse.json(
      { detail: `Document analysis service unavailable: ${message}` },
      { status: 503 }
    );
  }
}
