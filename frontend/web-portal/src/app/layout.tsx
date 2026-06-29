import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'BhumiChain — Land Registry on Blockchain',
  description: 'Tamper-proof land records on Hyperledger Fabric v2.5. Gautam Buddha Nagar pilot — Noida, Uttar Pradesh.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 font-sans">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#f3f4f6' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#f3f4f6' } },
          }}
        />
      </body>
    </html>
  );
}
