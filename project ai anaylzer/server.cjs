require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Multer config: store in memory, max 50MB ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// --- Serve static files and parse JSON ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- The system prompt for legal document extraction ---
const SYSTEM_PROMPT = `You are an Indian property-related legal document extraction assistant. You will receive the text or page images of a property-related legal document (e.g. sale deed, gift deed, lease deed, leave and license agreement, khata extract, patta, 7/12 extract, etc.).

Rules:
1. Return ONLY valid JSON — no markdown, no commentary, no explanation.
2. Translate all extracted values into English if the original document is in a regional Indian language (Hindi, Marathi, Gujarati, Tamil, Kannada, Telugu, Bengali, etc.).
3. Use null for any field not present in the document. Do not guess or infer values that aren't explicitly stated.
4. Under "type_specific", only populate the object matching the detected document_type. Set all other type_specific objects to null.
5. Dates must be formatted as YYYY-MM-DD. If only partial dates are available, extract what's present and note it in extraction_meta.low_confidence_fields.
6. "parties", "payment_details", "witnesses", and "shares_allotted" are arrays — include one object per entry found, and remove unused placeholder entries.
7. If a field's value is ambiguous or you're inferring rather than directly reading it, add its name to extraction_meta.low_confidence_fields.
8. Preserve original text/casing for names and legal descriptions, but translated to English where applicable.

JSON schema to fill:
{
  "document_type": null,
  "_document_type_options": [
    "sale_deed", "gift_deed", "mortgage_deed", "lease_deed", "leave_and_license_agreement",
    "agreement_to_sell", "partition_deed", "release_deed", "settlement_deed",
    "power_of_attorney", "will", "mutation_extract", "encumbrance_certificate",
    "property_tax_receipt", "khata_certificate", "patta", "7_12_extract",
    "rera_agreement", "occupancy_certificate", "possession_letter", "noc",
    "building_plan_approval", "completion_certificate"
  ],
  "registration_info": {
    "document_number": null,
    "registration_date": null,
    "execution_date": null,
    "sub_registrar_office": null,
    "taluka_or_tehsil": null,
    "district": null,
    "state": null,
    "book_number": null,
    "cd_volume_number": null,
    "page_number": null
  },
  "stamp_and_fees": {
    "stamp_duty_paid": null,
    "stamp_duty_currency": "INR",
    "registration_fee_paid": null,
    "estamp_certificate_number": null,
    "estamp_issue_date": null,
    "franking_number": null,
    "market_value_as_per_jantri_or_ready_reckoner": null
  },
  "parties": [
    {
      "role": null,
      "_role_options": ["vendor/seller", "vendee/purchaser", "donor", "donee", "lessor", "lessee",
                         "licensor", "licensee", "mortgagor", "mortgagee", "executant",
                         "power_of_attorney_holder", "confirming_party", "witness"],
      "name": null,
      "parentage": null,
      "age": null,
      "gender": null,
      "address": null,
      "pan_number": null,
      "aadhaar_last_4_digits": null,
      "occupation": null
    }
  ],
  "property": {
    "property_type": null,
    "_property_type_options": ["residential_plot", "flat_apartment", "agricultural_land", "commercial", "industrial"],
    "survey_number": null,
    "sub_plot_number": null,
    "block_number": null,
    "tp_scheme_number": null,
    "final_plot_number": null,
    "khasra_number": null,
    "gat_number": null,
    "khata_number": null,
    "property_card_number": null,
    "cts_number": null,
    "village": null,
    "taluka_or_tehsil": null,
    "district": null,
    "state": null,
    "pincode": null,
    "full_address": null,
    "area": {
      "value": null,
      "unit": null,
      "_unit_options": ["sq_ft", "sq_yards", "sq_meters", "acres", "guntha", "bigha", "cents", "hectares"]
    },
    "boundaries": {
      "north": null,
      "south": null,
      "east": null,
      "west": null
    },
    "flat_details": {
      "building_name": null,
      "wing_or_block": null,
      "floor_number": null,
      "flat_or_unit_number": null,
      "carpet_area": null,
      "built_up_area": null,
      "super_built_up_area": null,
      "undivided_share_of_land": null,
      "car_parking_number": null,
      "society_or_association_name": null,
      "rera_registration_number": null
    },
    "municipal_property_tax_assessment_number": null
  },
  "financial": {
    "total_consideration_amount": null,
    "consideration_currency": "INR",
    "consideration_in_words": null,
    "payment_mode": null,
    "payment_details": [
      {
        "mode": null,
        "_mode_options": ["cheque", "demand_draft", "rtgs_neft", "cash", "prior_payment_token_advance"],
        "amount": null,
        "instrument_number": null,
        "date": null,
        "bank_name": null
      }
    ],
    "loan_amount": null,
    "lender_bank_or_nbfc": null,
    "interest_rate": null,
    "loan_tenure": null
  },
  "title_chain": {
    "prior_deed_reference": {
      "document_type": null,
      "document_number": null,
      "date": null,
      "sub_registrar_office": null
    },
    "mode_of_prior_acquisition": null,
    "_mode_options": ["sale", "inheritance", "gift", "partition", "will", "allotment_by_authority"]
  },
  "encumbrance": {
    "encumbrance_certificate_number": null,
    "encumbrance_certificate_date": null,
    "search_period_years": null,
    "encumbrances_found": [null],
    "existing_mortgage_or_lien": null,
    "litigation_pending": null
  },
  "witnesses": [
    {
      "name": null,
      "address": null,
      "signature_present": null
    }
  ],
  "drafting_and_registration": {
    "document_drafted_by_advocate": null,
    "advocate_enrollment_number": null,
    "registered_before_sub_registrar_name": null,
    "identified_by": null
  },
  "type_specific": {
    "lease_deed": {
      "lease_start_date": null,
      "lease_end_date": null,
      "lease_period_months_or_years": null,
      "monthly_rent": null,
      "security_deposit": null,
      "rent_escalation_percentage": null,
      "escalation_frequency": null,
      "lock_in_period": null,
      "permitted_use": null,
      "renewal_clause": null,
      "registered_under_rent_act": null
    },
    "leave_and_license_agreement": {
      "license_start_date": null,
      "license_end_date": null,
      "license_fee_monthly": null,
      "refundable_deposit": null,
      "lock_in_period": null,
      "notice_period_for_termination": null
    },
    "gift_deed": {
      "relationship_between_donor_and_donee": null,
      "consideration_stated": "natural_love_and_affection",
      "is_revocable": null
    },
    "mortgage_deed": {
      "mortgagor": null,
      "mortgagee": null,
      "loan_account_number": null,
      "mortgage_type": null,
      "_mortgage_type_options": ["simple_mortgage", "equitable_mortgage_deposit_of_title_deeds", "usufructuary", "english_mortgage"],
      "loan_amount_secured": null,
      "possession_transferred": null
    },
    "partition_deed": {
      "co_owners": [null],
      "shares_allotted": [
        {"party_name": null, "share_description": null, "share_fraction_or_percentage": null}
      ]
    },
    "power_of_attorney": {
      "poa_type": null,
      "_poa_type_options": ["general", "special"],
      "principal": null,
      "attorney_holder": null,
      "powers_granted": [null],
      "is_registered": null,
      "revocation_status": null
    },
    "will": {
      "testator": null,
      "beneficiaries": [{"name": null, "relationship": null, "bequest_description": null}],
      "executor": null,
      "date_of_will": null,
      "probate_status": null
    },
    "encumbrance_certificate": {
      "applicant_name": null,
      "certificate_type": null,
      "_certificate_type_options": ["nil_encumbrance", "encumbrance_found"],
      "period_covered_from": null,
      "period_covered_to": null,
      "transactions_listed": [
        {"date": null, "document_number": null, "nature_of_transaction": null, "parties": null}
      ]
    },
    "mutation_extract": {
      "mutation_entry_number": null,
      "mutation_date": null,
      "previous_owner_name": null,
      "new_owner_name": null,
      "reason_for_mutation": null
    },
    "7_12_extract": {
      "survey_number": null,
      "cultivator_name": null,
      "area_of_land": null,
      "crop_details": null,
      "irrigation_source": null,
      "encumbrance_notes": null
    },
    "rera_agreement": {
      "rera_registration_number": null,
      "promoter_name": null,
      "allottee_name": null,
      "unit_number": null,
      "carpet_area": null,
      "total_consideration": null,
      "possession_date_promised": null,
      "payment_schedule": [{"milestone": null, "percentage": null, "amount": null}]
    },
    "building_plan_approval": {
      "sanctioning_authority": null,
      "date_of_approval": null,
      "plan_number": null,
      "validity_period": null,
      "permitted_usage": null,
      "setbacks_or_floor_area_ratio": null
    },
    "khata_certificate": {
      "owner_name": null,
      "property_identification_number_pid": null,
      "property_address": null,
      "tax_assessment_details": null
    },
    "property_tax_receipt": {
      "assessment_year": null,
      "owner_name_as_per_municipal_records": null,
      "payment_status": null,
      "amount_paid_or_due": null,
      "property_id_or_assessment_number": null
    },
    "occupancy_certificate": {
      "completion_date": null,
      "compliance_status": null,
      "issuing_authority": null,
      "safety_clearances": null,
      "oc_number": null,
      "oc_date": null
    },
    "completion_certificate": {
      "construction_details": null,
      "inspection_date": null,
      "compliance": null,
      "issuer": null,
      "cc_number": null,
      "cc_date": null
    },
    "noc": {
      "issuing_authority": null,
      "purpose": null,
      "property_reference": null,
      "validity_period": null,
      "noc_number": null,
      "noc_date": null
    },
    "patta": {
      "land_holder_name": null,
      "land_type": null,
      "area_and_survey_number": null,
      "tenancy_details": null,
      "revenue_rate": null,
      "patta_number": null
    }
  },
  "extraction_meta": {
    "source_file": null,
    "language_of_document": null,
    "pages_processed": null,
    "low_confidence_fields": [null],
    "manual_review_required": null
  }
}`;

// --- Convert PDF pages to base64 PNG images using pdfjs-dist + @napi-rs/canvas ---
async function convertPdfToImages(pdfBuffer) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = require('@napi-rs/canvas');

  const images = [];
  const MAX_PAGES = 15; // Limit pages to avoid huge API payloads
  const SCALE = 2.0; // Render at 2x for quality

  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdfDoc = await loadingTask.promise;
    const totalPages = Math.min(pdfDoc.numPages, MAX_PAGES);

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });

      const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Convert canvas to PNG buffer, then to base64
      const pngBuffer = canvas.toBuffer('image/png');
      const base64 = pngBuffer.toString('base64');
      images.push(base64);

      console.log(`  Page ${i}/${totalPages} rendered (${Math.floor(viewport.width)}x${Math.floor(viewport.height)})`);
    }

    if (pdfDoc.numPages > MAX_PAGES) {
      console.warn(`PDF has ${pdfDoc.numPages} pages, only processed first ${MAX_PAGES}.`);
    }
  } catch (err) {
    console.error('Error converting PDF to images:', err.message);
  }

  return images;
}

// --- Completeness Score Calculator ---
function calculateCompleteness(data) {
  let totalFields = 0;
  let populatedFields = 0;
  const missingCritical = [];

  function checkVal(val) {
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val)) {
      if (val.length === 0) return false;
      return val.some(item => {
        if (typeof item === 'object') {
          return Object.values(item).some(v => v !== null && v !== undefined && v !== '');
        }
        return item !== null && item !== undefined && item !== '';
      });
    }
    if (typeof val === 'object') {
      return Object.values(val).some(v => checkVal(v));
    }
    return true;
  }

  // Representative set of critical and key fields
  const paths = [
    { path: 'document_type', label: 'Document Type', critical: true },
    { path: 'registration_info.document_number', label: 'Document Number', critical: true },
    { path: 'registration_info.registration_date', label: 'Registration Date', critical: true },
    { path: 'registration_info.execution_date', label: 'Execution Date', critical: true },
    { path: 'registration_info.sub_registrar_office', label: 'Sub-Registrar Office' },
    { path: 'stamp_and_fees.stamp_duty_paid', label: 'Stamp Duty Paid' },
    { path: 'stamp_and_fees.registration_fee_paid', label: 'Registration Fee Paid' },
    { path: 'parties', label: 'Parties Details', critical: true },
    { path: 'property.property_type', label: 'Property Type' },
    { path: 'property.survey_number', label: 'Survey/Plot Number' },
    { path: 'property.full_address', label: 'Property Address', critical: true },
    { path: 'property.area.value', label: 'Property Area' },
    { path: 'financial.total_consideration_amount', label: 'Consideration Amount', critical: true },
    { path: 'financial.payment_details', label: 'Payment Details' },
    { path: 'witnesses', label: 'Witnesses Details', critical: true },
    { path: 'drafting_and_registration.document_drafted_by_advocate', label: 'Advocate Details' }
  ];

  paths.forEach(p => {
    totalFields++;
    const parts = p.path.split('.');
    let val = data;
    for (const part of parts) {
      if (val) val = val[part];
      else val = null;
    }

    const populated = checkVal(val);
    if (populated) {
      populatedFields++;
    } else if (p.critical) {
      missingCritical.push(p.label);
    }
  });

  const score = Math.round((populatedFields / totalFields) * 100);
  return { score, missingCritical };
}

// --- Helper to translate JSON via GPT-5.4 ---
async function translateJson(data, targetLanguage) {
  try {
    const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.DEPLOYMENT_NAME;

    const urlObj = new URL(rawEndpoint);
    const baseHost = `${urlObj.protocol}//${urlObj.host}`;
    const apiUrl = `${baseHost}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-12-01-preview`;

    const prompt = `You are a legal translation assistant. You will receive a JSON object containing legal document metadata.
Translate all the string values inside this JSON object into ${targetLanguage} (e.g. English or Hindi).

Rules:
1. Return ONLY the translated JSON object — no markdown, no commentary, no explanation.
2. Keep the JSON structure and keys exactly the same. Only translate the values (strings).
3. Do NOT translate:
   - Currency codes (e.g. keep "INR" as "INR")
   - Units (e.g. keep "sq_ft" as "sq_ft")
   - Option values if they match schema choices
   - Document type option lists
   - Numbers, numbers in strings (e.g. "xxxx-xxxx-1234") or dates formatted as "YYYY-MM-DD"
   - Field values that are null or empty
4. Make sure all legal terms, names, and addresses are appropriately transliterated/translated to ${targetLanguage} for maximum clarity.

JSON object to translate:
${JSON.stringify(data, null, 2)}`;

    const body = {
      messages: [
        { role: 'system', content: 'You are a translation assistant that outputs ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_completion_tokens: 8000,
      response_format: { type: 'json_object' }
    };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Azure OpenAI returned status ${res.status}`);
    }

    const azureData = await res.json();
    const content = azureData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content returned from translator.');

    return JSON.parse(content);
  } catch (err) {
    console.error(`Translation to ${targetLanguage} failed:`, err.message);
    return null; // Fallback to original
  }
}

// --- API endpoint: Translate on demand ---
app.post('/api/translate', async (req, res) => {
  try {
    const { data, targetLanguage } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided.' });
    if (!targetLanguage) return res.status(400).json({ error: 'No target language specified.' });

    if (targetLanguage.toLowerCase() === 'original') {
      return res.json({ success: true, data });
    }

    const translated = await translateJson(data, targetLanguage);
    if (!translated) {
      return res.status(500).json({ error: `Could not translate JSON to ${targetLanguage}.` });
    }

    return res.json({ success: true, data: translated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- API endpoint: Analyze ---
app.post('/api/analyze', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    // 1. Try to extract text from PDF
    const pdfParse = require('pdf-parse');
    let pdfText = '';
    let numPages = 0;

    try {
      const pdfData = await pdfParse(req.file.buffer);
      pdfText = pdfData.text || '';
      numPages = pdfData.numpages || 0;
    } catch (parseErr) {
      console.warn('pdf-parse failed, will try vision fallback:', parseErr.message);
    }

    const hasText = pdfText.trim().length > 50;

    // 2. Call Azure OpenAI GPT-5.4
    const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.DEPLOYMENT_NAME;

    const urlObj = new URL(rawEndpoint);
    const baseHost = `${urlObj.protocol}//${urlObj.host}`;
    const apiUrl = `${baseHost}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-12-01-preview`;

    let messages;
    let mode;

    if (hasText) {
      mode = 'text';
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract all relevant fields in the original language of the document:\n\n${pdfText}`,
        },
      ];
    } else {
      mode = 'vision';
      console.log('No text found in PDF. Converting pages to images for vision analysis...');

      const pageImages = await convertPdfToImages(req.file.buffer);
      numPages = pageImages.length;

      if (pageImages.length === 0) {
        return res.status(400).json({
          error: 'Could not process this PDF. The file may be corrupted or empty.',
        });
      }

      console.log(`Converted ${pageImages.length} page(s) to images. Sending to GPT-5.4 vision...`);

      const userContent = [
        {
          type: 'text',
          text: 'Extract all relevant fields in the original language of the document. Analyze each page image carefully.',
        },
        ...pageImages.map((base64Img, idx) => ({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Img}`,
            detail: 'high',
          },
        })),
      ];

      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ];
    }

    const body = {
      messages,
      temperature: 0.1,
      max_completion_tokens: 8000,
      response_format: { type: 'json_object' },
    };

    const azureRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!azureRes.ok) {
      const errText = await azureRes.text();
      console.error('Azure OpenAI Error:', azureRes.status, errText);
      return res.status(502).json({
        error: `Azure OpenAI returned status ${azureRes.status}`,
        details: errText,
      });
    }

    const azureData = await azureRes.json();
    const content = azureData.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: 'No response content from Azure OpenAI.' });
    }

    let originalData;
    try {
      originalData = JSON.parse(content);
    } catch {
      return res.status(502).json({
        error: 'Azure OpenAI returned invalid JSON.',
        raw: content,
      });
    }

    if (originalData.extraction_meta) {
      originalData.extraction_meta.source_file = req.file.originalname;
      originalData.extraction_meta.pages_processed = numPages;
    }

    // Compute completeness score on original extraction
    const { score, missingCritical } = calculateCompleteness(originalData);

    // Auto-translate to English and Hindi in parallel
    let englishData = originalData;
    let hindiData = originalData;
    const docLang = (originalData.extraction_meta?.language_of_document || '').toLowerCase();
    const isEnglish = docLang.includes('english') || docLang === 'en';
    const isHindi = docLang.includes('hindi') || docLang === 'hi';

    const translationPromises = [];

    // Queue English translation if not already English
    if (!isEnglish && docLang.trim().length > 0) {
      console.log(`Document language is "${originalData.extraction_meta?.language_of_document}". Queueing English translation...`);
      translationPromises.push(
        translateJson(originalData, 'English').then(res => {
          if (res) englishData = res;
        })
      );
    }

    // Queue Hindi translation if not already Hindi
    if (!isHindi && docLang.trim().length > 0) {
      console.log(`Document language is "${originalData.extraction_meta?.language_of_document}". Queueing Hindi translation...`);
      translationPromises.push(
        translateJson(originalData, 'Hindi').then(res => {
          if (res) hindiData = res;
        })
      );
    }

    // Wait for both translation processes to complete in parallel
    if (translationPromises.length > 0) {
      await Promise.all(translationPromises);
    }

    return res.json({
      success: true,
      data: originalData,         // Original language
      englishData: englishData,   // English translation
      hindiData: hindiData,       // Hindi translation
      meta: {
        filename: req.file.originalname,
        pages: numPages,
        textLength: pdfText.length,
        mode,
        score,                    // Completeness score (%)
        missingCritical,          // Missing critical fields
      },
    });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// --- Multer error handler ---
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`\n  🏛️  Legal Document Analyzer running at http://localhost:${PORT}\n`);
});
