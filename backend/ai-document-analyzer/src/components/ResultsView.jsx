import { useState } from 'react';
import Card from './Card';
import './ResultsView.css';

export default function ResultsView({ data, meta, onNewAnalysis }) {
  const [currentLang, setCurrentLang] = useState('english'); // Default is English per requirements
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine active dataset based on selected language toggle
  const getActiveData = () => {
    if (currentLang === 'original') return data.original;
    if (currentLang === 'hindi') return data.hindi;
    return data.english;
  };

  const activeData = getActiveData();

  const handleLanguageChange = (lang) => {
    setCurrentLang(lang);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(activeData, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const cards = buildCards(activeData);
  const isLowScore = meta.score < 40;

  return (
    <div className="results-section">
      {/* Header */}
      <div className="results-header">
        <h2>Extraction Results</h2>
        <div className="results-meta">
          <span className="meta-chip">
            <span className="chip-dot green" /> {meta.filename}
          </span>
          <span className="meta-chip">
            <span className="chip-dot blue" /> {meta.pages} page{meta.pages !== 1 ? 's' : ''}
          </span>
          <span className="meta-chip">
            <span className="chip-dot amber" /> {meta.mode === 'vision' ? 'Vision OCR Mode' : 'Text Extract Mode'}
          </span>
        </div>
      </div>

      {/* Language Selector Toggle */}
      <div className="language-selector-container">
        <span className="lang-label">View Document In:</span>
        <div className="lang-buttons">
          <button 
            className={`lang-btn ${currentLang === 'original' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('original')}
          >
            📄 Original ({data.original.extraction_meta?.language_of_document || 'Detected'})
          </button>
          <button 
            className={`lang-btn ${currentLang === 'english' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('english')}
          >
            🇬🇧 English
          </button>
          <button 
            className={`lang-btn ${currentLang === 'hindi' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('hindi')}
          >
            🇮🇳 Hindi
          </button>
        </div>
      </div>

      {/* Completeness Score Panel */}
      <div className="completeness-panel">
        <div className="completeness-header">
          <div className="score-circle-container">
            <div className={`score-ring ${isLowScore ? 'low' : meta.score >= 75 ? 'high' : 'medium'}`}>
              <span className="score-value">{meta.score}%</span>
            </div>
            <div className="score-info">
              <h3>Completeness Score</h3>
              <p>Based on the populated legal details in the standard Indian property schema.</p>
            </div>
          </div>
        </div>

        {meta.missingCritical && meta.missingCritical.length > 0 && (
          <div className="missing-fields-box">
            <h4>Missing Critical Fields:</h4>
            <div className="missing-tags">
              {meta.missingCritical.map((field, idx) => (
                <span key={idx} className="missing-tag">✕ {field}</span>
              ))}
            </div>
          </div>
        )}

        {isLowScore && (
          <div className="completeness-alert warning">
            <div className="alert-icon">⚠️</div>
            <div className="alert-content">
              <h4>Low Completeness Stated</h4>
              <p>The extracted information is below 40%. This typically indicates that critical sections are missing, pages are missing from the scanned copy, or the PDF scan resolution is too low. We recommend uploading a clearer, higher-resolution PDF file with all registration pages intact for better results.</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="results-actions">
        <button className="action-btn" onClick={() => setShowJson(!showJson)}>
          {showJson ? '✕ Hide JSON' : '{ } View Raw JSON'}
        </button>
      </div>

      {/* Raw JSON */}
      {showJson && (
        <div className="raw-json-section">
          <div className="raw-json-container">
            <div className="raw-json-header">
              <span>Raw JSON Output ({currentLang.toUpperCase()})</span>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="raw-json-pre">{JSON.stringify(activeData, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Cards Grid */}
      <div className="cards-grid">
        {cards.map((card, idx) => (
          <Card key={idx} {...card} delay={idx * 0.06} />
        ))}
      </div>

      {/* New Analysis */}
      <button className="new-analysis-btn" onClick={onNewAnalysis}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 105.64-11.36L1 10" />
        </svg>
        New Analysis
      </button>
    </div>
  );
}

/* ===== Build cards from data ===== */
function buildCards(data) {
  const cards = [];

  // 1. Document Info
  cards.push({
    icon: '📄', title: 'Document Information', color: 'blue', startOpen: true,
    fields: [
      { label: 'Document Type', value: data.document_type ? data.document_type.replace(/_/g, ' ').toUpperCase() : null },
      { label: 'Language', value: data.extraction_meta?.language_of_document },
    ],
  });

  // 2. Registration Info
  if (data.registration_info) {
    cards.push({
      icon: '🏛️', title: 'Registration Info', color: 'purple', startOpen: true,
      fields: [
        { label: 'Document #', value: data.registration_info.document_number },
        { label: 'Registration Date', value: data.registration_info.registration_date },
        { label: 'Execution Date', value: data.registration_info.execution_date },
        { label: 'Sub-Registrar Office', value: data.registration_info.sub_registrar_office },
        { label: 'Taluka / Tehsil', value: data.registration_info.taluka_or_tehsil },
        { label: 'District', value: data.registration_info.district },
        { label: 'State', value: data.registration_info.state },
        { label: 'Book Number', value: data.registration_info.book_number },
        { label: 'CD / Volume Number', value: data.registration_info.cd_volume_number },
        { label: 'Page Number', value: data.registration_info.page_number },
      ],
    });
  }

  // 3. Stamp & Fees
  if (data.stamp_and_fees) {
    cards.push({
      icon: '⚖️', title: 'Stamp Duty & Fees', color: 'teal',
      fields: [
        { label: 'Stamp Duty Paid', value: data.stamp_and_fees.stamp_duty_paid ? `₹${data.stamp_and_fees.stamp_duty_paid.toLocaleString('en-IN')}` : null },
        { label: 'Currency', value: data.stamp_and_fees.stamp_duty_currency },
        { label: 'Registration Fee Paid', value: data.stamp_and_fees.registration_fee_paid ? `₹${data.stamp_and_fees.registration_fee_paid.toLocaleString('en-IN')}` : null },
        { label: 'E-Stamp Cert. #', value: data.stamp_and_fees.estamp_certificate_number },
        { label: 'E-Stamp Issue Date', value: data.stamp_and_fees.estamp_issue_date },
        { label: 'Franking Number', value: data.stamp_and_fees.franking_number },
        { label: 'Ready Reckoner / Jantri Value', value: data.stamp_and_fees.market_value_as_per_jantri_or_ready_reckoner ? `₹${data.stamp_and_fees.market_value_as_per_jantri_or_ready_reckoner.toLocaleString('en-IN')}` : null },
      ],
    });
  }

  // 4. Parties
  if (data.parties?.length > 0 && data.parties.some(p => p.name)) {
    cards.push({
      icon: '👥', title: 'Parties Details', color: 'purple', startOpen: true,
      type: 'parties', parties: data.parties.filter(p => p.name),
    });
  }

  // 5. Property
  if (data.property) {
    const areaVal = data.property.area?.value;
    const areaUnit = data.property.area?.unit;
    const areaStr = areaVal ? `${areaVal} ${areaUnit ? areaUnit.replace(/_/g, ' ') : ''}` : null;

    const fields = [
      { label: 'Property Type', value: data.property.property_type ? data.property.property_type.replace(/_/g, ' ').toUpperCase() : null },
      { label: 'Survey Number', value: data.property.survey_number },
      { label: 'Sub-Plot Number', value: data.property.sub_plot_number },
      { label: 'Block Number', value: data.property.block_number },
      { label: 'TP Scheme Number', value: data.property.tp_scheme_number },
      { label: 'Final Plot Number', value: data.property.final_plot_number },
      { label: 'Khasra Number', value: data.property.khasra_number },
      { label: 'Gat Number', value: data.property.gat_number },
      { label: 'Khata Number', value: data.property.khata_number },
      { label: 'Property Card Number', value: data.property.property_card_number },
      { label: 'CTS Number', value: data.property.cts_number },
      { label: 'Village', value: data.property.village },
      { label: 'Taluka / Tehsil', value: data.property.taluka_or_tehsil },
      { label: 'District', value: data.property.district },
      { label: 'State', value: data.property.state },
      { label: 'Pincode', value: data.property.pincode },
      { label: 'Area', value: areaStr },
      { label: 'Full Address', value: data.property.full_address, type: 'long' },
    ];

    if (data.property.boundaries) {
      const b = data.property.boundaries;
      if (b.north || b.south || b.east || b.west) {
        fields.push({
          label: 'Boundaries',
          value: `North: ${b.north || '—'} | South: ${b.south || '—'} | East: ${b.east || '—'} | West: ${b.west || '—'}`,
          type: 'long',
        });
      }
    }

    if (data.property.flat_details && hasAnyValue(data.property.flat_details)) {
      const fd = data.property.flat_details;
      fields.push({
        label: 'Flat / Building Details',
        value: `Building: ${fd.building_name || '—'} | Wing/Block: ${fd.wing_or_block || '—'} | Floor: ${fd.floor_number || '—'} | Unit #: ${fd.flat_or_unit_number || '—'} | Carpet Area: ${fd.carpet_area || '—'} | Built-up: ${fd.built_up_area || '—'} | UDS: ${fd.undivided_share_of_land || '—'} | Parking: ${fd.car_parking_number || '—'} | Society: ${fd.society_or_association_name || '—'} | RERA #: ${fd.rera_registration_number || '—'}`,
        type: 'long',
      });
    }

    if (data.property.municipal_property_tax_assessment_number) {
      fields.push({ label: 'Municipal Tax Ass. #', value: data.property.municipal_property_tax_assessment_number });
    }

    cards.push({ icon: '🏠', title: 'Property Details', color: 'blue', fields });
  }

  // 6. Financial
  if (data.financial && hasAnyValue(data.financial)) {
    const fields = [
      { label: 'Total Consideration', value: data.financial.total_consideration_amount ? `₹${data.financial.total_consideration_amount.toLocaleString('en-IN')}` : null },
      { label: 'Currency', value: data.financial.consideration_currency },
      { label: 'Amount in Words', value: data.financial.consideration_in_words, type: 'long' },
      { label: 'Payment Mode', value: data.financial.payment_mode },
      { label: 'Loan Amount Secured', value: data.financial.loan_amount ? `₹${data.financial.loan_amount.toLocaleString('en-IN')}` : null },
      { label: 'Lender Bank/NBFC', value: data.financial.lender_bank_or_nbfc },
      { label: 'Interest Rate', value: data.financial.interest_rate },
      { label: 'Loan Tenure', value: data.financial.loan_tenure },
    ];

    cards.push({ icon: '💰', title: 'Financial Information', color: 'teal', fields });

    if (data.financial.payment_details?.length > 0 && data.financial.payment_details.some(p => p.amount)) {
      cards.push({
        icon: '💳', title: 'Payment Transaction Details', color: 'teal',
        type: 'payments', payments: data.financial.payment_details.filter(p => p.amount),
      });
    }
  }

  // 7. Title Chain & Encumbrance
  const hasTitleChain = data.title_chain && hasAnyValue(data.title_chain);
  const hasEncumbrance = data.encumbrance && hasAnyValue(data.encumbrance);
  if (hasTitleChain || hasEncumbrance) {
    const fields = [];
    if (data.title_chain) {
      const tc = data.title_chain;
      fields.push({ label: 'Prior Deed Mode', value: tc.mode_of_prior_acquisition });
      if (tc.prior_deed_reference && hasAnyValue(tc.prior_deed_reference)) {
        const pd = tc.prior_deed_reference;
        fields.push({
          label: 'Prior Deed Reference',
          value: `Type: ${pd.document_type || '—'} | Doc #: ${pd.document_number || '—'} | Date: ${pd.date || '—'} | SRO: ${pd.sub_registrar_office || '—'}`,
          type: 'long',
        });
      }
    }
    if (data.encumbrance) {
      const enc = data.encumbrance;
      fields.push({ label: 'EC Number', value: enc.encumbrance_certificate_number });
      fields.push({ label: 'EC Date', value: enc.encumbrance_certificate_date });
      fields.push({ label: 'Search Period (Years)', value: enc.search_period_years });
      if (enc.encumbrances_found?.length > 0 && enc.encumbrances_found[0] !== null) {
        fields.push({ label: 'Encumbrances Found', value: enc.encumbrances_found.join(', '), type: 'long' });
      }
      fields.push({ label: 'Existing Mortgage/Lien', value: enc.existing_mortgage_or_lien });
      fields.push({ label: 'Litigation Pending', value: enc.litigation_pending });
    }

    cards.push({ icon: '🔗', title: 'Title Chain & Encumbrances', color: 'purple', fields });
  }

  // 8. Witnesses
  if (data.witnesses?.length > 0 && data.witnesses.some(w => w.name)) {
    cards.push({
      icon: '✍️', title: 'Witnesses', color: 'purple',
      type: 'witnesses', witnesses: data.witnesses.filter(w => w.name),
    });
  }

  // 9. Drafting & Registration Office
  if (data.drafting_and_registration && hasAnyValue(data.drafting_and_registration)) {
    cards.push({
      icon: '📝', title: 'Drafting & Sub-Registrar', color: 'amber',
      fields: [
        { label: 'Drafted by Advocate', value: data.drafting_and_registration.document_drafted_by_advocate },
        { label: 'Advocate Enrollment #', value: data.drafting_and_registration.advocate_enrollment_number },
        { label: 'Registered Before Registrar', value: data.drafting_and_registration.registered_before_sub_registrar_name },
        { label: 'Identified By', value: data.drafting_and_registration.identified_by },
      ],
    });
  }

  // 10. Type-Specific Details
  if (data.type_specific && data.document_type) {
    const tsCard = buildTypeSpecific(data.document_type, data.type_specific);
    if (tsCard) cards.push(tsCard);
  }

  // 11. Extraction Meta
  if (data.extraction_meta) {
    const lowConf = (data.extraction_meta.low_confidence_fields || []).filter(f => f !== null);
    cards.push({
      icon: '⚙️', title: 'Extraction Metadata', color: 'amber',
      type: 'meta',
      metaData: {
        source_file: data.extraction_meta.source_file,
        language_of_document: data.extraction_meta.language_of_document,
        pages_processed: data.extraction_meta.pages_processed,
        low_confidence_fields: lowConf,
        manual_review_required: data.extraction_meta.manual_review_required,
      },
    });
  }

  return cards;
}

function buildTypeSpecific(docType, typeSpecific) {
  const typeMap = {
    sale_deed: { icon: '📜', title: 'Sale Deed Specifics', color: 'blue', key: 'sale_deed' },
    gift_deed: { icon: '🎁', title: 'Gift Deed Specifics', color: 'rose', key: 'gift_deed' },
    mortgage_deed: { icon: '🏦', title: 'Mortgage Deed Specifics', color: 'teal', key: 'mortgage_deed' },
    lease_deed: { icon: '📋', title: 'Lease Deed Specifics', color: 'purple', key: 'lease_deed' },
    leave_and_license_agreement: { icon: '🔑', title: 'Leave & License Details', color: 'purple', key: 'leave_and_license_agreement' },
    partition_deed: { icon: '🧱', title: 'Partition Deed Specifics', color: 'blue', key: 'partition_deed' },
    power_of_attorney: { icon: '⚡', title: 'Power of Attorney Specifics', color: 'amber', key: 'power_of_attorney' },
    will: { icon: '✍️', title: 'Will Specifics', color: 'amber', key: 'will' },
    encumbrance_certificate: { icon: '🔍', title: 'EC Details', color: 'teal', key: 'encumbrance_certificate' },
    mutation_extract: { icon: '📊', title: 'Mutation Entry Details', color: 'teal', key: 'mutation_extract' },
    seven_twelve_extract: { icon: '🚜', title: '7/12 Extract Specifics', color: 'blue', key: 'seven_twelve_extract' },
    rera_agreement: { icon: '🏢', title: 'RERA Agreement Details', color: 'teal', key: 'rera_agreement' },
  };

  const normalized = docType.toLowerCase().replace(/\s+/g, '_');
  const config = typeMap[normalized];
  if (!config) return null;

  const specificData = typeSpecific[config.key];
  if (!specificData || !hasAnyValue(specificData)) return null;

  const fields = Object.entries(specificData).flatMap(([key, val]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (Array.isArray(val)) {
      const filtered = val.filter(v => v !== null);
      if (filtered.length > 0 && typeof filtered[0] === 'object') {
        // e.g. payment_schedule, beneficiaries, shares_allotted
        return filtered.map((item, idx) => ({
          label: `${label} #${idx + 1}`,
          value: Object.entries(item).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v || '—'}`).join(' | '),
          type: 'long',
        }));
      }
      return [{ label, value: filtered.length > 0 ? filtered.join(', ') : null }];
    }
    if (val !== null && typeof val === 'object') {
      return [{
        label,
        value: Object.entries(val).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v || '—'}`).join(' | '),
        type: 'long',
      }];
    }
    return [{ label, value: val }];
  });

  return { icon: config.icon, title: config.title, color: config.color, fields };
}

function hasAnyValue(obj) {
  if (!obj) return false;
  return Object.values(obj).some(v => {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.some(item => item !== null);
    if (typeof v === 'object') return hasAnyValue(v);
    return true;
  });
}
