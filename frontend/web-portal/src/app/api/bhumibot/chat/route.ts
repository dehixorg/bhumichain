import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DOC_ANALYZER_SERVICE = process.env.DOC_ANALYZER_URL || 'http://localhost:8014';
const BHUMIBOT_SERVICE     = process.env.BHUMIBOT_SERVICE_URL || 'http://localhost:8015';

function formatDa2Summary(resData: any): string {
  const data = resData.englishData || resData.data || {};
  const meta = resData.meta || {};

  const lines: string[] = [];
  lines.push(`Document Analysis Summary for file: ${meta.filename || 'Uploaded Document'}`);
  lines.push(`Extraction Mode: ${meta.mode || 'N/A'} | Completeness Score: ${meta.score || 0}% | Pages Processed: ${meta.pages || 1}`);
  if (data.document_type) {
    lines.push(`Detected Document Type: ${data.document_type}`);
  }

  if (data.registration_info) {
    const r = data.registration_info;
    lines.push(`\n### Registration Details`);
    if (r.document_number) lines.push(`- Document Number: ${r.document_number}`);
    if (r.registration_date) lines.push(`- Registration Date: ${r.registration_date}`);
    if (r.execution_date) lines.push(`- Execution Date: ${r.execution_date}`);
    if (r.sub_registrar_office) lines.push(`- Sub-Registrar Office: ${r.sub_registrar_office}`);
    if (r.taluka_or_tehsil) lines.push(`- Tehsil/Taluka: ${r.taluka_or_tehsil}`);
    if (r.district) lines.push(`- District: ${r.district}`);
    if (r.state) lines.push(`- State: ${r.state}`);
  }

  if (data.parties && Array.isArray(data.parties) && data.parties.length > 0) {
    lines.push(`\n### Parties Involved`);
    data.parties.forEach((p: any, idx: number) => {
      if (p.name || p.role) {
        lines.push(`- Party ${idx + 1}: Role=${p.role || 'N/A'}, Name=${p.name || 'N/A'}, Address=${p.address || 'N/A'}, PAN=${p.pan_number || 'N/A'}, Aadhaar Last4=${p.aadhaar_last_4_digits || 'N/A'}`);
      }
    });
  }

  if (data.property) {
    const p = data.property;
    lines.push(`\n### Property Description`);
    if (p.property_type) lines.push(`- Property Type: ${p.property_type}`);
    if (p.survey_number) lines.push(`- Survey/Plot/Gat Number: ${p.survey_number}`);
    if (p.khata_number) lines.push(`- Khata Number: ${p.khata_number}`);
    if (p.khasra_number) lines.push(`- Khasra Number: ${p.khasra_number}`);
    if (p.village) lines.push(`- Village: ${p.village}`);
    if (p.taluka_or_tehsil) lines.push(`- Tehsil: ${p.taluka_or_tehsil}`);
    if (p.district) lines.push(`- District: ${p.district}`);
    if (p.state) lines.push(`- State: ${p.state}`);
    if (p.full_address) lines.push(`- Full Address: ${p.full_address}`);
    if (p.area && p.area.value) lines.push(`- Area: ${p.area.value} ${p.area.unit || ''}`);
    if (p.boundaries) lines.push(`- Boundaries: North=${p.boundaries.north || 'N/A'}, South=${p.boundaries.south || 'N/A'}, East=${p.boundaries.east || 'N/A'}, West=${p.boundaries.west || 'N/A'}`);
  }

  if (data.financial) {
    const f = data.financial;
    lines.push(`\n### Financial Terms`);
    if (f.total_consideration_amount) lines.push(`- Consideration Amount: ₹${f.total_consideration_amount}`);
    if (f.payment_mode) lines.push(`- Payment Mode: ${f.payment_mode}`);
    if (f.payment_details && Array.isArray(f.payment_details)) {
      f.payment_details.forEach((pd: any) => {
        if (pd.amount || pd.instrument_number) {
          lines.push(`- Instrument: Mode=${pd.mode || 'N/A'}, Amount=₹${pd.amount || 0}, No=${pd.instrument_number || 'N/A'}, Bank=${pd.bank_name || 'N/A'}`);
        }
      });
    }
  }

  if (data.stamp_and_fees) {
    const s = data.stamp_and_fees;
    lines.push(`\n### Stamp Duty & Fees`);
    if (s.stamp_duty_paid) lines.push(`- Stamp Duty Paid: ₹${s.stamp_duty_paid}`);
    if (s.registration_fee_paid) lines.push(`- Registration Fee Paid: ₹${s.registration_fee_paid}`);
    if (s.estamp_certificate_number) lines.push(`- e-Stamp Cert #: ${s.estamp_certificate_number}`);
  }

  if (data.encumbrance) {
    const e = data.encumbrance;
    lines.push(`\n### Encumbrances & Claims`);
    if (e.existing_mortgage_or_lien) lines.push(`- Existing Mortgage/Lien: ${e.existing_mortgage_or_lien}`);
    if (e.litigation_pending) lines.push(`- Pending Litigation: ${e.litigation_pending}`);
    if (e.encumbrance_declaration_statement) lines.push(`- Encumbrance Declaration: ${e.encumbrance_declaration_statement}`);
  }

  if (data.type_specific) {
    lines.push(`\n### Type-Specific Legal Details`);
    lines.push(JSON.stringify(data.type_specific, null, 2));
  }

  lines.push(`\n### Full Extracted Legal Data JSON Structure`);
  lines.push(JSON.stringify(data, null, 2));

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    let query = '';
    let conversationHistory: any[] = [];
    let documentContext: any = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      query = (formData.get('query') as string) || '';
      const historyStr = (formData.get('conversation_history') as string) || '[]';
      try {
        conversationHistory = JSON.parse(historyStr);
      } catch {
        conversationHistory = [];
      }

      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        // Send document to AI Document Analyzer (Port 8014 - da2 engine)
        const docFormData = new FormData();
        docFormData.append('file', file);

        try {
          console.log(`[/api/bhumibot/chat] Forwarding attached file "${file.name}" to da2 Document Analyzer (Port 8014)...`);
          const docRes = await fetch(`${DOC_ANALYZER_SERVICE}/api/analyze`, {
            method: 'POST',
            body: docFormData,
          });

          if (docRes.ok) {
            const da2Result = await docRes.json();
            const summaryText = formatDa2Summary(da2Result);
            const docData = da2Result.englishData || da2Result.data || {};

            documentContext = {
              document_name: file.name,
              document_type: docData.document_type || 'Attached Legal Document',
              extracted_text: summaryText,
              metadata: {
                filename: file.name,
                pages: da2Result.meta?.pages || 1,
                score: da2Result.meta?.score || 0,
                mode: da2Result.meta?.mode || 'text',
                raw_json: docData,
              },
            };
          } else {
            const errText = await docRes.text();
            console.warn('[/api/bhumibot/chat] da2 Document Analyzer returned status:', docRes.status, errText);
          }
        } catch (analyzerErr: any) {
          console.error('[/api/bhumibot/chat] da2 Document Analyzer error:', analyzerErr?.message || analyzerErr);
        }
      }
    } else {
      // JSON payload
      const body = await req.json();
      query = body.query || '';
      conversationHistory = body.conversation_history || [];
      documentContext = body.document || null;
    }

    if (!query && !documentContext) {
      return NextResponse.json({ error: 'Query or document required' }, { status: 400 });
    }

    // Call BhumiBot AI Service (Port 8015)
    const bhumiBotPayload = {
      query: query || 'Analyze the attached document and answer all questions regarding it in full legal detail.',
      conversation_history: conversationHistory,
      document: documentContext,
    };

    console.log(`[/api/bhumibot/chat] Calling BhumiBot AI (Port 8015) with query="${query.slice(0, 50)}...", doc=${documentContext ? documentContext.document_name : 'None'}`);

    const resBhumiBot = await fetch(`${BHUMIBOT_SERVICE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bhumiBotPayload),
    });

    if (!resBhumiBot.ok) {
      const errDetail = await resBhumiBot.text();
      console.error('[/api/bhumibot/chat] BhumiBot Service Error:', resBhumiBot.status, errDetail);
      return NextResponse.json(
        { answer: 'BhumiBot AI service error. Please verify backend services are running.' },
        { status: 502 }
      );
    }

    const data = await resBhumiBot.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[/api/bhumibot/chat Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
