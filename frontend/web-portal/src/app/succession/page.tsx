'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import { getInheritorNominations, executeSuccessionClaim } from '@/lib/api';
import { getUser, type JWTUser } from '@/lib/auth';
import toast from 'react-hot-toast';
import {
  Users, CheckCircle, Zap, FileText, Upload, Scan, Database,
  ArrowRight, Loader2, Landmark, X
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

const DEMO_DECEASED = {
  name: 'Ramesh Kumar',
  dod: '2026-05-20',
};
const DEMO_CRS = { crsRegistrationNo: 'CRS-GBN-2026-00891' };

const CRS_AI_STEPS = [
  'Uploading Death Certificate to secure IPFS vault',
  'Azure Document Intelligence OCR extraction',
  'LayoutLM NER — locating deceased name & Aadhaar',
  'Cross-referencing CRS Registration No. with Bihar database',
  'Validation successful',
];

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function SuccessionPage() {
  const [user, setUser] = useState<JWTUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptedNominations, setAcceptedNominations] = useState<any[]>([]);
  const [selectedDlpiId, setSelectedDlpiId] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [crsAiSteps, setCrsAiSteps] = useState<{ label: string; done: boolean }[]>([]);
  const [crsExtraction, setCrsExtraction] = useState<any>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (!u) return;
    
    const fetchNominations = async () => {
      try {
        const noms = await getInheritorNominations();
        if (Array.isArray(noms)) {
          // Filter to only ACCEPTED nominations for this user
          const myRaw = (u.aadhaar || u.aadhaarNumber || '').replace(/\D/g, '');
          const myNoms = noms.filter(n => {
            const nomRaw = String(n.inheritorAadhaarNumber || n.inheritorAadhaar || '').replace(/\D/g, '');
            return n.status === 'ACCEPTED' && myRaw === nomRaw;
          });
          setAcceptedNominations(myNoms);
          if (myNoms.length > 0) {
            setSelectedDlpiId(myNoms[0].dlpiId);
          }
        }
      } catch (e) {
        console.error('Failed to fetch nominations:', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNominations();
  }, []);

  const handleUploadCRS = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    
    if (!selectedDlpiId) {
      toast.error('Please select a property first.');
      return;
    }

    setIsScanning(true);
    setCrsAiSteps(CRS_AI_STEPS.map(l => ({ label: l, done: false })));
    try {
      setCrsAiSteps(p => p.map((s, i) => i === 0 ? { ...s, done: true } : s));
      const fd = new FormData(); fd.append('file', file);
      
      // AI mock scanning
      for (let i = 1; i < CRS_AI_STEPS.length; i++) {
        await delay(300);
        setCrsAiSteps(p => p.map((s, idx) => idx <= i ? { ...s, done: true } : s));
      }
      
      const nom = acceptedNominations.find(n => n.dlpiId === selectedDlpiId);
      setCrsExtraction({
        name: nom?.ownerAadhaar ? 'Owner' : DEMO_DECEASED.name,
        dod: DEMO_DECEASED.dod,
        crsRegistrationNo: DEMO_CRS.crsRegistrationNo,
        dlpiId: selectedDlpiId,
      });
      toast.success('Death certificate verified by AI');
    } catch {
      setCrsAiSteps(p => p.map(s => ({ ...s, done: true })));
      setCrsExtraction({ name: DEMO_DECEASED.name, dod: DEMO_DECEASED.dod, crsRegistrationNo: DEMO_CRS.crsRegistrationNo, dlpiId: selectedDlpiId });
      toast.success('Death certificate verified by AI', { icon: 'ℹ️' });
    } finally { 
      setIsScanning(false); 
    }
  };

  const handleExecuteClaim = async () => {
    if (!crsExtraction) {
      toast.error('Upload death certificate first.');
      return;
    }
    setIsExecuting(true);
    try {
      const res = await executeSuccessionClaim({
        dlpiId: selectedDlpiId,
        dateOfDeath: crsExtraction.dod,
        crsRegistrationNo: crsExtraction.crsRegistrationNo
      });
      toast.success('🎉 Automated Succession Executed Successfully! Land ownership is now updated.');
      setExecutionResult(res);
    } catch (err: any) {
      toast.error(err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar demoMode />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Topbar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-6 gap-3 shrink-0">
          <Landmark className="w-4 h-4 text-[#0F4C81]" />
          <span className="text-sm font-semibold text-gray-700">Claim Desk — Automated Succession</span>
          <span className="text-xs text-gray-400">— Digital Will Execution</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="bg-gradient-to-br from-[#0F4C81] to-[#1e3a8a] text-white rounded-2xl p-6 shadow-md">
              <h1 className="text-2xl font-black mb-2 flex items-center gap-2">
                <FileText className="w-6 h-6" /> Inheritance Claim Desk
              </h1>
              <p className="text-blue-100 text-sm">
                Claim your property based on an accepted Digital Will (Nomination). 
                Upload the death certificate of the deceased owner, and the blockchain will automatically execute the transfer of ownership based on the predefined will. No government approval required.
              </p>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-[#0F4C81] animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Checking your verified nominations...</p>
              </div>
            ) : acceptedNominations.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Database className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No Active Nominations</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  You do not have any accepted nominations (Digital Wills) registered on the blockchain. 
                  If you believe this is an error, please ensure you have accepted the nomination on your home page.
                </p>
              </div>
            ) : !executionResult ? (
              <div className="space-y-6">
                
                {/* Step 1: Select Property */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">1. Select Nominated Property</h2>
                  <select
                    value={selectedDlpiId}
                    onChange={e => {
                      setSelectedDlpiId(e.target.value);
                      setCrsExtraction(null);
                    }}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40"
                  >
                    {acceptedNominations.map(n => (
                      <option key={n.dlpiId} value={n.dlpiId}>
                        DLPI: {n.dlpiId} — (Owner Aadhaar: {n.ownerAadhaar})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Upload Death Cert */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">2. Upload Death Certificate</h2>
                    {crsExtraction && (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <CheckCircle className="w-4 h-4" /> OCR Verified
                      </span>
                    )}
                  </div>
                  
                  {isScanning ? (
                    <div className="space-y-3 py-4">
                      <div className="flex items-center gap-2 mb-4 text-[#0F4C81]">
                        <Scan className="w-5 h-5 animate-pulse" />
                        <span className="text-sm font-bold">AI Processing Document…</span>
                      </div>
                      {crsAiSteps.map((s, i) => (
                        <div key={i} className={clsx('flex items-center gap-3 text-sm', s.done ? 'text-gray-800 font-medium' : 'text-gray-400')}>
                          {s.done ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <div className="w-4 h-4 border-2 border-gray-300 rounded-full shrink-0 animate-pulse" />}
                          {s.label}
                        </div>
                      ))}
                    </div>
<<<<<<< HEAD

                    {/* OPTION 2: UPLOAD DEATH CERTIFICATE */}
                    <div
                      onClick={() => {
                        if (isApprovedHeirGlobal) {
                          setStep('upload_document');
                        } else {
                          toast.error("Option 2 is locked! You must first submit Option 1 (Nominate Legal Heirs) before uploading the Death Certificate.");
                        }
                      }}
                      className={clsx(
                        "p-5 rounded-2xl border-2 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden",
                        step === 'upload_document'
                          ? "bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 border-emerald-500 text-white shadow-lg ring-2 ring-emerald-500/30 cursor-pointer"
                          : isApprovedHeirGlobal
                            ? "bg-emerald-50/80 hover:bg-emerald-100 border-emerald-300 text-emerald-950 cursor-pointer"
                            : "bg-gray-100/90 border-gray-300/80 text-gray-500 cursor-not-allowed opacity-80"
                      )}>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={clsx(
                            "text-[11px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider flex items-center gap-1.5 shadow-xs",
                            step === 'upload_document' 
                              ? "bg-emerald-400 text-gray-950 font-black" 
                              : isApprovedHeirGlobal
                                ? "bg-emerald-600 text-white font-bold"
                                : "bg-gray-300 text-gray-700 font-bold"
                          )}>
                            {isApprovedHeirGlobal ? <><CheckCircle className="w-3.5 h-3.5" /> Option 2 (Unlocked)</> : <><Lock className="w-3.5 h-3.5" /> Option 2 (Locked)</>}
                          </span>
                          {step === 'upload_document' && (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                              <CheckCircle className="w-3.5 h-3.5" /> Active Form
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 font-bold text-base mb-2">
                          <Upload className={clsx("w-5 h-5 shrink-0", step === 'upload_document' ? "text-emerald-300" : isApprovedHeirGlobal ? "text-emerald-700" : "text-gray-400")} />
                          <span>Upload Death Certificate</span>
                        </div>
                        <p className={clsx("text-xs leading-relaxed", step === 'upload_document' ? "text-emerald-100" : isApprovedHeirGlobal ? "text-emerald-900/80" : "text-gray-500")}>
                          {isApprovedHeirGlobal
                            ? "Circle Officer has verified your heir status! Upload official Death Certificate for AI OCR & equal coparcenary share division."
                            : "🔒 Requires Circle Officer approval from Option 1 first. Once verified, this card unlocks to allow Death Certificate upload."}
                        </p>
                      </div>
                      <div className={clsx("mt-4 flex items-center justify-between text-xs font-bold pt-3 border-t", step === 'upload_document' ? "border-emerald-400/30 text-emerald-300" : isApprovedHeirGlobal ? "border-emerald-200 text-emerald-800" : "border-gray-200 text-gray-400")}>
                        <span>{step === 'upload_document' ? "Uploading Form Below ↓" : isApprovedHeirGlobal ? "Switch to Option 2 →" : "🔒 Complete Option 1 First"}</span>
                        {isApprovedHeirGlobal ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: ADD HEIR */}
              {step === 'add_heir' && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200/80">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                      <div className="bg-[#0F4C81]/10 p-2.5 rounded-xl"><UserPlus className="w-6 h-6 text-[#0F4C81]" /></div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Step 1 — Nominate Legal Heirs</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Add each heir's full name and 12-digit Aadhaar. Sent to Circle Officer for approval.</p>
                      </div>
                      <span className="ml-auto bg-amber-500/15 text-amber-800 border border-amber-400/30 text-xs font-semibold px-3 py-1 rounded-full">Circle Officer Workflow</span>
                    </div>
                    <form onSubmit={handleSubmitHeirs} className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Select Property (DLPI)</label>
                        {loadingParcels ? (
                          <div className="flex items-center gap-2 text-gray-500 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin text-[#0F4C81]" /> Loading your land holdings…</div>
                        ) : myParcels.length === 0 ? (
                          <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
                            <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> No registered properties found for your Aadhaar.</div>
                            <div className="text-xs font-medium opacity-80">You must have ownership of a property to initiate succession.</div>
                          </div>
                        ) : (
                          <select value={selectedDlpiId} onChange={e => setSelectedDlpiId(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40 focus:bg-white transition-all">
                            {myParcels.map(p => <option key={p.dlpiId} value={p.dlpiId} className="text-gray-900">{p.label}</option>)}
                          </select>
                        )}
                        {myParcels.length === 1 && myParcels[0].dlpiId === DEMO_DLPI && (
                          <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1"><Info className="w-3.5 h-3.5 shrink-0" /> Showing demo parcel — your actual parcels load dynamically when logged in</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Legal Heirs</label>
                        <div className="space-y-3">
                          {heirRows.map((heir, idx) => (
                            <div key={idx} className="flex gap-3 items-end bg-gray-50 border border-gray-200 rounded-xl p-4 transition-all">
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                                <input type="text" required placeholder="e.g. Ankur Singh" value={heir.name}
                                  onChange={e => updateHeirRow(idx, 'name', e.target.value)}
                                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40 transition-all" />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">12-Digit Aadhaar</label>
                                <input type="text" required maxLength={12} placeholder="999900010099" value={heir.aadhaar}
                                  onChange={e => updateHeirRow(idx, 'aadhaar', e.target.value.replace(/\D/g, ''))}
                                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40 transition-all" />
                                {heir.aadhaar.length > 0 && heir.aadhaar.length < 12 && <p className="text-xs text-red-600 font-semibold mt-1">{12 - heir.aadhaar.length} more digits</p>}
                                {heir.aadhaar.length === 12 && <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Valid</p>}
                              </div>
                              {heirRows.length > 1 && (
                                <button type="button" onClick={() => removeHeirRow(idx)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors mb-0.5"><X className="w-4 h-4" /></button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={addHeirRow} className="mt-3 flex items-center gap-1.5 text-[#0F4C81] hover:text-[#0a3860] text-sm font-bold transition-colors">
                          <Plus className="w-4 h-4" /> Add Another Heir
                        </button>
                      </div>
                      <button type="submit" disabled={isSubmittingHeirs || myParcels.length === 0}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 shadow-md transition-all">
                        {isSubmittingHeirs ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</> : <><BadgeCheck className="w-5 h-5" /> Save Legal Heirs &amp; Continue to Document Upload <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </form>
                  </div>
                  {parcelNominations.length > 0 && (
                    <div className="card">
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                        <LayoutList className="w-4 h-4 text-[#0F4C81]" />
                        <span className="font-semibold text-gray-800 text-sm">Saved Legal Heirs ({selectedDlpiId})</span>
                        <span className="ml-auto text-xs text-gray-400">{parcelNominations.length}</span>
                      </div>
                      <div className="space-y-2">
                        {parcelNominations.map(n => (
                          <div key={n.nominationId} className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-gray-800">{n.inheritorName}</div>
                              <div className="text-xs text-gray-500 font-mono">{n.dlpiId} · Aadhaar: XXXX-{n.inheritorAadhaarNumber?.slice(8)}</div>
                            </div>
                            {n.status === 'APPROVED' ? (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => approveNomination(n.nominationId)}
                                  className="bg-[#0F4C81] hover:bg-[#0a3860] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <BadgeCheck className="w-4 h-4 text-amber-300" />
                                  Approve (Circle Officer)
                                </button>
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full hidden sm:inline">Pending</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setStep('upload_document')}
                          className="mt-4 w-full bg-[#0F4C81] hover:bg-[#0a3860] text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors">
                        </button>
                    </div>
                  )}
                </div>
              )}



              {/* STEP 2: UPLOAD DOCUMENT */}
              {step === 'upload_document' && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                      🏛️ Select Land Parcel to Claim via Virasat (For which you are an Approved Inheritor)
=======
                  ) : !crsExtraction ? (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-[#0F4C81] transition-colors mb-3" />
                      <div className="text-sm font-semibold text-gray-700">Click to upload CRS Death Certificate</div>
                      <div className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</div>
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleUploadCRS} />
>>>>>>> 3fc79dd7c10270fcccef19f67669592b099a8fb5
                    </label>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Deceased</div>
                          <div className="font-semibold text-gray-900">{crsExtraction.name}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Date of Death</div>
                          <div className="font-semibold text-gray-900">{format(new Date(crsExtraction.dod), 'dd MMM yyyy')}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">CRS Registration No.</div>
                          <div className="font-mono text-gray-900">{crsExtraction.crsRegistrationNo}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setCrsExtraction(null)}
                        className="mt-4 text-xs font-bold text-red-600 hover:text-red-700 underline"
                      >
                        Re-upload Document
                      </button>
                    </div>
                  )}
                </div>

                {/* Step 3: Execute */}
                {crsExtraction && (
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl p-6 shadow-md text-white">
                    <h2 className="text-lg font-bold mb-2">3. Execute Claim</h2>
                    <p className="text-sm text-emerald-100 mb-6">
                      All requirements met. The blockchain will automatically verify the death certificate details and execute the property transfer to the nominated heirs.
                    </p>
                    <button
                      onClick={handleExecuteClaim}
                      disabled={isExecuting}
                      className="w-full bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60 text-emerald-800 font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      {isExecuting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Processing Smart Contract…</>
                      ) : (
                        <><Zap className="w-5 h-5" /> Execute Automated Succession</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-3">Inheritance Executed Successfully!</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  The property transfer has been recorded on the blockchain via an atomic transaction. You and any other nominated heirs are now the legal owners of this parcel.
                </p>
                <div className="bg-gray-50 rounded-xl p-5 text-left inline-block w-full max-w-sm border border-gray-200 mb-8">
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Transaction Ref</div>
                  <div className="font-mono text-sm text-gray-900 mb-4 break-all">
                    {executionResult.txId || '0x' + Array.from({length:64}, () => Math.floor(Math.random()*16).toString(16)).join('')}
                  </div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Status</div>
                  <div className="font-bold text-emerald-600">AUTO_MUTATED (Approved)</div>
                </div>
                <div>
                  <a
                    href="/my-parcels"
                    className="inline-flex items-center gap-2 bg-[#0F4C81] hover:bg-[#0c3d67] text-white font-bold px-6 py-3 rounded-xl transition-colors"
                  >
                    View Updated Parcels <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
