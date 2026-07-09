import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'BhumiChain — National Land Registry Platform',
  description: 'Tamper-proof land records on Hyperledger Fabric v2.5. Secure, transparent and paperless land registration for every Indian citizen.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] font-sans text-gray-900">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#0F172A',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(15,76,129,.10)',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#138808', secondary: '#ffffff' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: '#ffffff' } },
          }}
        />
      </body>
    </html>
  );
}
