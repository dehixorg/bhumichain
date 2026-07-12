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
    let dod = "";
    let reg_no = "CRS-UNKNOWN";
    let aadhaar = "";

    const nameMatch = text.match(/(?:Name of Deceased|Deceased Name|Name)[:\-\s]+([A-Za-z\s]+)(?:\n|\r|$)/i);
    if (nameMatch && nameMatch[1]) name = nameMatch[1].trim();

    // Permissive Date of Death regex (matches DD/MM/YYYY, DD-MMM-YYYY, DD MM YYYY, etc.)
    const dodMatch = text.match(/(?:Date of Death|DOD|Date)[:\-\s]*([0-9]{1,2}[\-\/\s\.]+[A-Za-z0-9]{2,9}[\-\/\s\.]+[0-9]{2,4})/i);
    if (dodMatch && dodMatch[1]) {
      dod = dodMatch[1].trim();
    }

    const regMatch = text.match(/(?:Registration No|Reg No)[:\.\-\s]+([A-Z0-9\-]+)/i);
    if (regMatch && regMatch[1]) reg_no = regMatch[1].trim();

    const aadhaarMatch = text.match(/(?:Aadhaar|Aadhar|UID|Aadhaar No|UID No)[:\.\-\s]*(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}|X{4}[\s\-]?X{4}[\s\-]?\d{4})/i);
    if (aadhaarMatch && aadhaarMatch[1]) aadhaar = aadhaarMatch[1].trim();

    return NextResponse.json({
      name,
      dod: dod || undefined, // undefined lets frontend use default if missing
      crsRegistrationNo: reg_no,
      dlpiId: "DLPI-UP-DAD-00100",
      aadhaarHash: aadhaar || "XXXX-XXXX-1234",
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
