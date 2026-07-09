import React from 'react';

export default function CitizenFooter() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-20">
      {/* Top Banner section */}
      <div className="bg-[#F1F5F9] border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">About BhumiChain</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              BhumiChain is the National Land Registry Platform, securing land titles and records on Hyperledger Fabric. A flagship initiative by the Ministry of Rural Development.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Quick Links</h4>
            <ul className="text-xs text-gray-500 space-y-2">
              <li><a href="#" className="hover:text-[#0F4C81] transition-colors">Apply Mutation</a></li>
              <li><a href="#" className="hover:text-[#0F4C81] transition-colors">Download RoR</a></li>
              <li><a href="#" className="hover:text-[#0F4C81] transition-colors">View Map (Bhu-Naksha)</a></li>
              <li><a href="#" className="hover:text-[#0F4C81] transition-colors">Succession Rules</a></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Help & Support</h4>
            <ul className="text-xs text-gray-500 space-y-2">
              <li><a href="#" className="hover:text-[#0F4C81] transition-colors">Citizen Helpdesk</a></li>
              <li><a href="#" className="hover:text-[#0F4C81] transition-colors">Contact Tehsildar</a></li>
              <li><a href="#" className="hover:text-[#0F4C81] transition-colors">FAQs</a></li>
              <li><a href="#" className="hover:text-[#0F4C81] transition-colors">Grievance Redressal</a></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Security & Trust</h4>
            <ul className="text-xs text-gray-500 space-y-2">
              <li className="flex items-center gap-2">🔒 256-bit AES Encryption</li>
              <li className="flex items-center gap-2">🔗 Hyperledger Fabric Blockchain</li>
              <li className="flex items-center gap-2">🇮🇳 MeitY / CERT-In Audited</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Logos & Copyright */}
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6 opacity-75 grayscale hover:grayscale-0 transition-all">
          <img src="/nic-logo.png" alt="National Informatics Centre" className="h-10 w-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
          <img src="/Digital-India-Color.svg" alt="Digital India" className="h-10 w-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
        </div>
        
        <div className="text-xs text-gray-400 text-center sm:text-right">
          <p>© 2026 Government of India, Ministry of Rural Development.</p>
          <p className="mt-1">Designed & Developed for 100 Cr+ Citizens.</p>
        </div>
      </div>
    </footer>
  );
}
