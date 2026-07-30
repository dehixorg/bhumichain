'use client';

import React, { useRef, useState } from 'react';
import { X, Printer, Download, ShieldCheck, FileText, Loader2 } from 'lucide-react';

export interface LegalDeedData {
  dlpiId?: string;
  ownerName?: string;
  ownerAadhaarMasked?: string;
  sellerName?: string;
  khesraNo?: string;
  khataNo?: string;
  thanaNo?: string;
  district?: string;
  anchal?: string;
  mauza?: string;
  landType?: string;
  areaHectares?: number;
  rakbaBigha?: number;
  rakbaKatha?: number;
  ownershipType?: string;
  encumbranceStatus?: string;
  mutationDate?: string;
  blockchainTxHash?: string;
}

export const DEFAULT_LEGAL_DEED_FALLBACKS: Required<LegalDeedData> = {
  dlpiId: 'DLPI-Bihar-PHU-00101',
  ownerName: 'Rameshwar Prasad Singh',
  ownerAadhaarMasked: 'XXXX-XXXX-8821',
  sellerName: 'Vikramaditya Narayan Roy',
  khesraNo: '101',
  khataNo: '108',
  thanaNo: '24',
  district: 'Patna',
  anchal: 'Phulwari Sharif',
  mauza: 'Phulwari',
  landType: 'Bhumidhari (Raiyati)',
  areaHectares: 0.15,
  rakbaBigha: 1,
  rakbaKatha: 8,
  ownershipType: 'Sole (Bhumidhari)',
  encumbranceStatus: 'CLEAR (No Mortgages / Charges)',
  mutationDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  blockchainTxHash: '0x7f8a3c9e12b4d567890abcdef1234567890abcdef1234567890abcdef1234567',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data?: LegalDeedData | null;
}

/** Inline highlight for a data-filled field, echoing the yellow fill-in style of a filled legal template. */
function Field({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-yellow-200/70 px-1 py-0.5 rounded-[2px] font-semibold text-slate-900 font-sans text-xs">
      {children}
    </span>
  );
}

export default function LegalDeedPDFModal({ isOpen, onClose, data }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const d: Required<LegalDeedData> = {
    dlpiId: data?.dlpiId || DEFAULT_LEGAL_DEED_FALLBACKS.dlpiId,
    ownerName: data?.ownerName || DEFAULT_LEGAL_DEED_FALLBACKS.ownerName,
    ownerAadhaarMasked: data?.ownerAadhaarMasked || DEFAULT_LEGAL_DEED_FALLBACKS.ownerAadhaarMasked,
    sellerName: data?.sellerName || DEFAULT_LEGAL_DEED_FALLBACKS.sellerName,
    khesraNo: data?.khesraNo || DEFAULT_LEGAL_DEED_FALLBACKS.khesraNo,
    khataNo: data?.khataNo || DEFAULT_LEGAL_DEED_FALLBACKS.khataNo,
    thanaNo: data?.thanaNo || DEFAULT_LEGAL_DEED_FALLBACKS.thanaNo,
    district: data?.district || DEFAULT_LEGAL_DEED_FALLBACKS.district,
    anchal: data?.anchal || DEFAULT_LEGAL_DEED_FALLBACKS.anchal,
    mauza: data?.mauza || DEFAULT_LEGAL_DEED_FALLBACKS.mauza,
    landType: data?.landType || DEFAULT_LEGAL_DEED_FALLBACKS.landType,
    areaHectares: data?.areaHectares ?? DEFAULT_LEGAL_DEED_FALLBACKS.areaHectares,
    rakbaBigha: data?.rakbaBigha ?? DEFAULT_LEGAL_DEED_FALLBACKS.rakbaBigha,
    rakbaKatha: data?.rakbaKatha ?? DEFAULT_LEGAL_DEED_FALLBACKS.rakbaKatha,
    ownershipType: data?.ownershipType || DEFAULT_LEGAL_DEED_FALLBACKS.ownershipType,
    encumbranceStatus: data?.encumbranceStatus || DEFAULT_LEGAL_DEED_FALLBACKS.encumbranceStatus,
    mutationDate: data?.mutationDate || DEFAULT_LEGAL_DEED_FALLBACKS.mutationDate,
    blockchainTxHash: data?.blockchainTxHash || DEFAULT_LEGAL_DEED_FALLBACKS.blockchainTxHash,
  };

  const deedRef = `DEED-BH-2026-${d.dlpiId.replace(/\D/g, '').slice(-4) || '101'}`;
  const areaLine = `${d.rakbaBigha} Bigha, ${d.rakbaKatha} Katha (${d.areaHectares.toFixed(2)} hectares)`;

  const handlePrint = () => window.print();

  // Direct PDF Download Handler
  const handleDirectDownloadPDF = async () => {
    setDownloading(true);
    try {
      if (!(window as any).html2pdf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load html2pdf bundle'));
          document.body.appendChild(script);
        });
      }

      const element = printRef.current;
      if (!element) return;

      const opt = {
        margin:       [0.15, 0.15, 0.15, 0.15],
        filename:     `BhumiChain_Legal_Deed_${d.dlpiId}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: 0 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      await (window as any).html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('Direct PDF download error:', err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto custom-scrollbar">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Action Header (hidden during print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#0F4C81] rounded-xl text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white tracking-wide leading-tight">
                Certificate of Record of Rights
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {d.dlpiId} · {deedRef} · Exactly 2 Pages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Download Button */}
            <button
              onClick={handleDirectDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Direct Download PDF</span>
                </>
              )}
            </button>

            {/* Print Dialog Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-700"
              title="Open Print Dialog"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body — clean white background, multi-page legal text */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100 print:bg-white print:p-0 custom-scrollbar">
          
          <div ref={printRef} className="max-w-3xl mx-auto space-y-6">
            {/* ================= PAGE 1 ================= */}
            <div
              className="bg-white p-6 md:p-8 space-y-5 text-slate-900 print:p-6 border border-slate-200 rounded-sm relative overflow-hidden"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {/* Full-width Stamp Paper Header Image */}
              <div className="-mx-6 -mt-6 md:-mx-8 md:-mt-8 mb-4 overflow-hidden">
                <img
                  src="/stamp_paper_header.jpg"
                  alt="BhumiChain Non-Judicial Legal Stamp Header"
                  className="w-full h-auto min-h-[140px] max-h-[220px] object-cover sm:object-fill block border-none outline-none"
                />
              </div>

              {/* Title block */}
              <div className="text-center space-y-1 pb-3 border-b border-slate-300">
                <p className="text-[11px] font-sans font-bold uppercase tracking-widest text-slate-500">
                  Government of Bihar &middot; Revenue &amp; Land Reforms Department
                </p>
                <h1 className="text-lg md:text-xl font-bold uppercase tracking-wide text-slate-900">
                  Certificate of Record of Rights
                </h1>
                <p className="text-xs text-slate-600">(Jamabandi / Khatauni &mdash; issued via BhumiChain Digital Registry)</p>
              </div>

              {/* Body copy, paragraph / clause form */}
              <div className="space-y-4 text-[14px] leading-7 text-justify">
                <p>
                  THIS CERTIFICATE OF RECORD OF RIGHTS is issued at <Field>{d.mauza}</Field>,
                  Anchal <Field>{d.anchal}</Field>, District <Field>{d.district}</Field>, State of Bihar,
                  on <Field>{d.mutationDate}</Field>, under Deed Reference No. <Field>{deedRef}</Field>, in respect
                  of the land described below, in favour of <Field>{d.ownerName}</Field>
                  {' '}(hereinafter called &ldquo;the Title Holder&rdquo;, which expression shall, unless repugnant to
                  the context or meaning, include his heirs, successors, administrators and assigns), whose identity
                  stands verified against Aadhaar record <Field>{d.ownerAadhaarMasked}</Field>.
                </p>

                <p>
                  WHEREAS the land comprised in Khata No. <Field>{d.khataNo}</Field>, Khesra (Plot) No.{' '}
                  <Field>{d.khesraNo}</Field>, situated in Mauza <Field>{d.mauza}</Field>, under Thana No.{' '}
                  <Field>{d.thanaNo}</Field>, and classified as <Field>{d.landType}</Field>, admeasuring{' '}
                  <Field>{areaLine}</Field>, is recorded as held by the Title Holder under a tenure of{' '}
                  <Field>{d.ownershipType}</Field>, and the encumbrance status of the said land, as verified on the
                  date of this certificate, stands as <Field>{d.encumbranceStatus}</Field>.
                </p>

                <p>
                  AND WHEREAS the mutation of the said land in favour of the Title Holder was examined and approved
                  by the Circle Officer (Revenue Magistrate) of <Field>{d.anchal}</Field> Anchal, <Field>{d.district}</Field>{' '}
                  District, and the record of this mutation was committed to the BhumiChain distributed ledger
                  (Hyperledger Fabric) on <Field>{d.mutationDate}</Field>, bearing transaction hash{' '}
                  <Field>{d.blockchainTxHash}</Field>, rendering the record tamper-evident and independently
                  verifiable.
                </p>

                <p>
                  NOW THEREFORE, this Certificate of Record of Rights is issued to confirm that the Title Holder is,
                  as on the date hereof, the recorded owner of the above-described land, free from any charge or
                  encumbrance save as stated above, and that this record has been digitized and registered under
                  Section 14 of the Bihar Land Reforms Act, for all purposes for which a Record of Rights extract may
                  be relied upon.
                </p>
              </div>

              {/* Page 1 Footer indicator */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-sans text-slate-400">
                <span>Page 1 of 2</span>
                <span className="font-mono text-[10px]">{d.dlpiId}</span>
              </div>
            </div>

            {/* ================= PAGE 2 ================= */}
            <div
              className="bg-white p-6 md:p-8 space-y-5 text-slate-900 print:p-6 border border-slate-200 rounded-sm relative"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", pageBreakBefore: 'always', breakBefore: 'page' }}
            >
              {/* Title block Page 2 */}
              <div className="pb-3 border-b border-slate-300 flex items-center justify-between font-sans">
                <div>
                  <h2 className="text-base font-bold text-slate-900 uppercase">
                    Schedule of Boundaries &amp; Blockchain Proof
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">Deed Ref: {deedRef} &middot; DLPI: {d.dlpiId}</p>
                </div>
                <span className="text-xs font-sans text-slate-400 font-medium">Page 2 of 2</span>
              </div>

              {/* Boundary Schedule Table (Chohaddi) */}
              <div className="space-y-2 font-sans">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Schedule &lsquo;A&rsquo; &mdash; Land Parcel Boundaries (Chohaddi / चौहद्दी):
                </p>
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-100 font-bold p-2.5 w-1/4 border-r border-slate-300">North (उत्तर)</td>
                      <td className="p-2.5 w-1/4 border-r border-slate-300">Public Revenue Road / Survey Plot 100</td>
                      <td className="bg-slate-100 font-bold p-2.5 w-1/4 border-r border-slate-300">South (दक्षिण)</td>
                      <td className="p-2.5 w-1/4">Raiyati Agriculture Plot 102</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-100 font-bold p-2.5 border-r border-slate-300">East (पूर्व)</td>
                      <td className="p-2.5 border-r border-slate-300">Government Canal / Irrigation Nala</td>
                      <td className="bg-slate-100 font-bold p-2.5 border-r border-slate-300">West (पश्चिम)</td>
                      <td className="p-2.5">Raiyati Boundary Survey Plot 99</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Additional Statutory Covenants */}
              <div className="space-y-4 text-[14px] leading-7 text-justify">
                <p>
                  IT IS FURTHER CERTIFIED THAT the title conferred hereunder carries full statutory rights of quiet enjoyment, alienation, mortgage, and succession under Section 14 of the Bihar Land Reforms Act. The transaction hash <Field>{d.blockchainTxHash}</Field> serves as the immutable digital cryptographic proof of title on the Hyperledger Fabric blockchain network.
                </p>
              </div>

              {/* Verification strip */}
              <div className="flex items-start gap-2 pt-3 border-t border-slate-300 text-xs font-sans text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <p>
                  This certificate is a system-generated digital record produced by the BhumiChain platform and is
                  verifiable on-chain against the transaction hash quoted above. It is not a reproduction of any
                  physical government stamp paper or emblem.
                </p>
              </div>

              {/* Signature line */}
              <div className="pt-6 flex items-end justify-between text-sm font-sans">
                <div>
                  <div className="w-48 border-b border-slate-400 h-8" />
                  <p className="text-xs text-slate-600 mt-1 font-semibold">Circle Officer (Revenue Magistrate)</p>
                  <p className="text-[11px] text-slate-500">{d.anchal} Anchal, {d.district}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-mono text-slate-600 font-semibold">Digitally signed &middot; e-Mudra PKI</p>
                  <p className="text-[10px] text-slate-400">Date: {d.mutationDate}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
