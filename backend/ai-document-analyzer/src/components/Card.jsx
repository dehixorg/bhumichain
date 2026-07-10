import { useState } from 'react';
import './Card.css';

export default function Card({ icon, title, color, fields, type, parties, payments, witnesses, metaData, startOpen = false, delay = 0 }) {
  const [open, setOpen] = useState(startOpen);

  return (
    <div
      className={`card${open ? ' open' : ''}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="card-header" onClick={() => setOpen(!open)}>
        <div className="card-header-left">
          <div className={`card-icon ${color}`}>{icon}</div>
          <span className="card-title">{title}</span>
        </div>
        <svg className="card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <div className="card-body">
        <div className="card-content">
          {type === 'parties' && <PartiesTable parties={parties} />}
          {type === 'payments' && <PaymentsTable payments={payments} />}
          {type === 'witnesses' && <WitnessesTable witnesses={witnesses} />}
          {type === 'meta' && <MetaContent data={metaData} />}
          {!type && fields && fields.map((f, i) => <FieldRow key={i} {...f} />)}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value, type }) {
  if (type === 'confidence') {
    return (
      <div className="field-row">
        <span className="field-label">{label}</span>
        <span className="field-value">
          <ConfidenceBadge value={value} />
        </span>
      </div>
    );
  }

  const isNull = value === null || value === undefined;
  const isLong = type === 'long' || (typeof value === 'string' && value.length > 120);

  if (isLong && !isNull) {
    return (
      <div className="field-row field-row-col">
        <span className="field-label">{label}</span>
        <span className="field-value long-text">{String(value)}</span>
      </div>
    );
  }

  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className={`field-value${isNull ? ' null-val' : ''}`}>
        {isNull ? '—' : String(value)}
      </span>
    </div>
  );
}

function ConfidenceBadge({ value }) {
  if (value === null || value === undefined) {
    return <span className="field-value null-val">—</span>;
  }
  const num = typeof value === 'string' ? parseFloat(value) : value;
  let cls = 'medium';
  if (num >= 0.85) cls = 'high';
  else if (num < 0.5) cls = 'low';
  const pct = typeof num === 'number' ? `${(num * 100).toFixed(0)}%` : value;
  return (
    <span className={`confidence-badge ${cls}`}>
      ● {pct} {cls.charAt(0).toUpperCase() + cls.slice(1)}
    </span>
  );
}

function PartiesTable({ parties }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="parties-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Name & Details</th>
            <th>PAN & Aadhaar</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p, i) => (
            <tr key={i}>
              <td><span className="role-badge">{p.role || '—'}</span></td>
              <td>
                <div style={{ fontWeight: '600' }}>{p.name || '—'}</div>
                {p.parentage && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Parent: {p.parentage}</div>}
                {(p.age || p.gender || p.occupation) && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {[p.age ? `Age: ${p.age}` : null, p.gender ? `Gen: ${p.gender}` : null, p.occupation ? `Occ: ${p.occupation}` : null].filter(Boolean).join(' | ')}
                  </div>
                )}
              </td>
              <td>
                {p.pan_number && <div>PAN: <code style={{ color: 'var(--accent-teal)' }}>{p.pan_number}</code></div>}
                {p.aadhaar_last_4_digits && <div>Aadhaar: <code style={{ color: 'var(--accent-blue)' }}>xxxx-xxxx-{p.aadhaar_last_4_digits}</code></div>}
                {!p.pan_number && !p.aadhaar_last_4_digits && <span className="null-val">—</span>}
              </td>
              <td style={{ fontSize: '0.78rem', maxWidth: '180px', wordBreak: 'break-word' }}>{p.address || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({ payments }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="parties-table">
        <thead>
          <tr>
            <th>Mode</th>
            <th>Amount</th>
            <th>Instrument Detail</th>
            <th>Bank & Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={i}>
              <td><span className="role-badge" style={{ background: 'rgba(20, 184, 166, 0.12)', color: 'var(--accent-teal)' }}>{p.mode || '—'}</span></td>
              <td style={{ fontWeight: '600' }}>{p.amount ? `₹${p.amount.toLocaleString('en-IN')}` : '—'}</td>
              <td>{p.instrument_number ? <code>{p.instrument_number}</code> : '—'}</td>
              <td style={{ fontSize: '0.78rem' }}>
                <div>{p.bank_name || '—'}</div>
                {p.date && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.date}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WitnessesTable({ witnesses }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="parties-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Address</th>
            <th>Signature Present</th>
          </tr>
        </thead>
        <tbody>
          {witnesses.map((w, i) => (
            <tr key={i}>
              <td style={{ fontWeight: '600' }}>{w.name || '—'}</td>
              <td style={{ fontSize: '0.78rem' }}>{w.address || '—'}</td>
              <td>
                <span className={`confidence-badge ${w.signature_present ? 'high' : 'low'}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                  {w.signature_present ? 'Yes' : 'No'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetaContent({ data }) {
  return (
    <>
      <FieldRow label="Source File" value={data.source_file} />
      <FieldRow label="Language of Document" value={data.language_of_document} />
      <FieldRow label="Pages Processed" value={data.pages_processed} />
      <div className="field-row field-row-col">
        <span className="field-label">Low Confidence Fields</span>
        {data.low_confidence_fields && data.low_confidence_fields.length > 0 && data.low_confidence_fields[0] !== null ? (
          <div className="tag-list">
            {data.low_confidence_fields.map((f, i) => (
              <span className="tag" key={i}>{f}</span>
            ))}
          </div>
        ) : (
          <span className="field-value null-val">None</span>
        )}
      </div>
      <FieldRow
        label="Manual Review Required"
        value={data.manual_review_required !== null ? (data.manual_review_required ? 'Yes' : 'No') : null}
      />
    </>
  );
}
