import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BlockchainAuditTrail({ dlpiId, onClose }: { dlpiId: string; onClose: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'mock';
        let url = `/api/dlpi/${dlpiId}/history`;
        if (API !== 'mock') url = `${API}${url}`;

        const token = localStorage.getItem('bhumichain_token');
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [dlpiId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#111] border border-green-500/30 rounded-2xl w-full max-w-3xl overflow-hidden shadow-[0_0_40px_rgba(34,197,94,0.15)] flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-green-500/20 bg-green-500/5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-green-400">🔗</span> Blockchain Audit Trail
            </h2>
            <p className="text-sm text-green-400/70 font-mono mt-1">Immutable Ledger Record for {dlpiId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4" />
              <div className="text-green-400/80 font-mono text-sm animate-pulse">Syncing nodes...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-gray-500 py-12 font-mono">No history found on the ledger.</div>
          ) : (
            <div className="relative pl-6 border-l border-green-500/20 space-y-8 my-4">
              {history.map((tx, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={tx.txId} 
                  className="relative"
                >
                  <div className="absolute -left-[31px] bg-[#111] p-1 rounded-full border border-green-500/50">
                    <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]" />
                  </div>
                  
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] hover:border-green-500/30 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-bold text-green-400 text-lg">{tx.action.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-gray-500 font-mono bg-black/40 px-3 py-1 rounded-full border border-white/5">
                        {new Date(tx.timestamp).toLocaleString('en-IN')}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                      <div>
                        <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Transaction Hash</div>
                        <div className="text-gray-300 font-mono truncate bg-black/30 p-2 rounded text-xs border border-white/5" title={tx.txId}>
                          {tx.txId}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Actor (Signer)</div>
                        <div className="text-gray-300 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">
                            👤
                          </div>
                          {tx.actor}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-white/10 bg-black/40 text-center text-xs text-gray-500 font-mono">
          Secured by BhumiChain Hyperledger Fabric Network
        </div>
      </motion.div>
    </div>
  );
}
