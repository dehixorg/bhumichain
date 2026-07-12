import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Source = buffer.toString('base64');

    // Azure Config
    const endpoint = process.env.AZURE_DOC_INTEL_ENDPOINT || "https://dehixchatbot-resource.services.ai.azure.com";
    const key = process.env.AZURE_DOC_INTEL_KEY;
    const model = "prebuilt-layout";
    
    if (!key) {
      throw new Error("AZURE_DOC_INTEL_KEY environment variable is missing");
    }

    // 1. Submit to Azure using axios
    const submitUrl = `${endpoint.replace(/\/$/, '')}/formrecognizer/documentModels/${model}:analyze?api-version=2023-07-31`;
    
    const submitRes = await axios.post(submitUrl, buffer, {
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/octet-stream'
      },
      validateStatus: () => true // Handle errors manually
    });

    if (submitRes.status >= 400) {
      throw new Error(`Azure Submit Failed: ${submitRes.status} ${JSON.stringify(submitRes.data)}`);
    }

    const operationUrl = submitRes.headers['operation-location'];
    if (!operationUrl) throw new Error("No Operation-Location returned by Azure");

    // 2. Poll for results using axios
    let status = "running";
    let text = "";
    
    // Poll up to 15 times (30 seconds)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      
      const pollRes = await axios.get(operationUrl, {
        headers: { 'Ocp-Apim-Subscription-Key': key },
        validateStatus: () => true
      });
      
      if (pollRes.status >= 400) throw new Error(`Azure Poll Failed: ${pollRes.status}`);
      
      const pollData = pollRes.data;
      status = pollData.status;
      
      if (status === "succeeded") {
        const pages = pollData.analyzeResult?.pages || [];
        const lines: string[] = [];
        pages.forEach((page: any) => {
          (page.lines || []).forEach((line: any) => {
            lines.push(line.content);
          });
        });
        text = lines.join("\n");
        break;
      } else if (status === "failed") {
        throw new Error("Azure OCR failed to process document");
      }
    }
    
    if (status !== "succeeded") throw new Error("Azure OCR timed out");

    // 3. Regex Extraction
    let name = "Unknown";
    let dod = "2026-05-20";
    let reg_no = "CRS-UNKNOWN";

    const nameMatch = text.match(/(?:Name of Deceased|Deceased Name|Name)[:\-\s]+([A-Za-z\s]+)(?:\n|\r|$)/i);
    if (nameMatch && nameMatch[1]) name = nameMatch[1].trim();

    const dodMatch = text.match(/(?:Date of Death|DOD)[:\-\s]+(\d{2}[-/\.]\d{2}[-/\.]\d{4}|\d{4}[-/\.]\d{2}[-/\.]\d{2})/i);
    if (dodMatch && dodMatch[1]) {
      const parts = dodMatch[1].replace(/[\/\.]/g, '-').split('-');
      if (parts[0].length === 4) {
        dod = `${parts[0]}-${parts[1]}-${parts[2]}`;
      } else {
        dod = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const regMatch = text.match(/(?:Registration No|Reg No)[:\.\-\s]+([A-Z0-9\-]+)/i);
    if (regMatch && regMatch[1]) reg_no = regMatch[1].trim();

    return NextResponse.json({
      name,
      dod,
      crsRegistrationNo: reg_no,
      dlpiId: "DLPI-UP-DAD-00100",
      aadhaarHash: "XXXX-XXXX-1234",
      rawText: text
    });

  } catch (err: any) {
    const message = err.message || 'Unknown OCR error';
    console.error('[/api/scan/death-cert] Error:', message);
    return NextResponse.json(
      { detail: `OCR Service Unavailable: ${message}` },
      { status: 503 }
    );
  }
}
