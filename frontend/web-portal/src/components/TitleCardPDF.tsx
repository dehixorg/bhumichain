import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'react-qr-code';

interface TitleCardProps {
  parcel: any;
  user: any;
}

export default function TitleCardPDF({ parcel, user }: TitleCardProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    const element = printRef.current;
    if (!element) return;

    try {
      // Show element for capture
      element.style.display = 'block';
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      // Hide again
      element.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`BhumiChain_Title_Deed_${parcel.dlpiId}.pdf`);
    } catch (e) {
      console.error('Failed to generate PDF', e);
      if (element) element.style.display = 'none';
    }
  };

  return (
    <>
      <button 
        onClick={handleDownloadPdf}
        className="w-full mt-3 bg-white/5 hover:bg-white/10 text-white font-medium py-2 px-4 rounded-xl text-sm transition-colors border border-white/10 flex items-center justify-center gap-2"
      >
        📑 Download Title Card PDF
      </button>

      {/* Hidden PDF Template */}
      <div 
        ref={printRef} 
        style={{ display: 'none', width: '210mm', minHeight: '297mm', padding: '20mm', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif' }}
      >
        <div style={{ textAlign: 'center', borderBottom: '2px solid #16a34a', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', color: '#16a34a', margin: '0 0 10px 0', fontWeight: 'bold' }}>GOVERNMENT OF BIHAR</h1>
          <h2 style={{ fontSize: '20px', color: '#374151', margin: '0 0 5px 0' }}>Department of Revenue and Land Reforms</h2>
          <h3 style={{ fontSize: '16px', color: '#6b7280', margin: '0' }}>Digital Smart Title Deed (BhumiChain)</h3>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>DLPI (Unique Property ID)</p>
            <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{parcel.dlpiId}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Issue Date</p>
            <p style={{ fontSize: '16px', margin: 0 }}>{new Date().toLocaleDateString('en-IN')}</p>
          </div>
        </div>

        <div style={{ backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
          <h4 style={{ fontSize: '16px', color: '#16a34a', margin: '0 0 15px 0', borderBottom: '1px solid #d1d5db', paddingBottom: '8px' }}>Property Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Area</span>
              <div style={{ fontWeight: 'bold' }}>{parcel.areaHectares || parcel.area} Hectares</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Land Type</span>
              <div style={{ fontWeight: 'bold' }}>{parcel.landType}</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Village Code</span>
              <div style={{ fontWeight: 'bold' }}>{parcel.villageCode || 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Encumbrance Status</span>
              <div style={{ fontWeight: 'bold', color: parcel.hasEncumbrance ? '#dc2626' : '#16a34a' }}>
                {parcel.hasEncumbrance ? 'Active Liens Exists' : 'Clear Title'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px', marginBottom: '40px' }}>
          <h4 style={{ fontSize: '16px', color: '#16a34a', margin: '0 0 15px 0', borderBottom: '1px solid #d1d5db', paddingBottom: '8px' }}>Registered Owner(s)</h4>
          {parcel.owners?.map((owner: any, idx: number) => (
            <div key={idx} style={{ marginBottom: idx !== parcel.owners.length - 1 ? '15px' : '0' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{owner.name}</div>
              <div style={{ fontSize: '14px', color: '#4b5563' }}>Aadhaar: **** **** {owner.aadhaarNumber?.replace(/\D/g, '').slice(-4) || 'XXXX'}</div>
              <div style={{ fontSize: '14px', color: '#4b5563' }}>Ownership Share: {owner.shareFraction || owner.share || '1/1'}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '40px', borderTop: '2px solid #e5e7eb' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Blockchain Verification QR</div>
            <div style={{ padding: '10px', backgroundColor: '#fff', display: 'inline-block', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <QRCode value={`https://bhumichain.in/verify/${parcel.dlpiId}`} size={100} />
            </div>
          </div>
          
          <div style={{ textAlign: 'right', maxWidth: '250px' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1.4 }}>
              This document is cryptographically secured by the BhumiChain Hyperledger Fabric Network. 
              The QR code can be scanned to verify authenticity directly from the blockchain ledger.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
