'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Lock, ChevronRight, AlertCircle, CheckCircle,
  FileText, Map, GitMerge, ArrowLeftRight, Users,
  Server, Eye, EyeOff, Smartphone, Fingerprint,
  CloudLightning, Database, Award, CheckSquare,
} from 'lucide-react';
import clsx from 'clsx';
import AadhaarInput from '@/components/auth/AadhaarInput';
import OTPInput from '@/components/auth/OTPInput';
import {
  requestOTP, verifyOTP, officerLogin, demoLogin, getRedirectPath,
} from '@/lib/auth';

type Tab  = 'citizen' | 'officer';
type Step = 'aadhaar' | 'otp';
type AuthMethod = 'digilocker' | 'aadhaar' | 'mobile' | 'janparichay';

// ── Demo personas ─────────────────────────────────────────────────────────────
const DEMO_PERSONAS = [
  { persona: 'tehsildar',        label: 'Tehsildar',  name: 'Amit Saxena',  color: '#7C3AED', aadhaar: '9999-0001-0001' },
  { persona: 'circle_inspector', label: 'Kanungo',    name: 'Rajesh Verma', color: '#1D4ED8', aadhaar: '9999-0001-0002' },
  { persona: 'patwari',          label: 'Patwari',    name: 'Vijay Singh',  color: '#0F766E', aadhaar: '9999-0001-0003' },
  { persona: 'citizen',          label: 'Citizen 1',  name: 'Priya Kumar',  color: '#6D28D9', aadhaar: '9999-0001-0010' },
  { persona: 'suresh_yadav',     label: 'Citizen 2',  name: 'Suresh Yadav', color: '#B45309', aadhaar: '9999-0001-0012' },
  { persona: 'citizen_heir2',    label: 'Citizen 3',  name: 'Sunita Kumar', color: '#BE185D', aadhaar: '9999-0001-0015' },
];

// ── Trust Badges ──────────────────────────────────────────────────────────────
const TRUST_BADGES = [
  { label: 'Aadhaar Verified',      color: 'text-[#138808]', bg: 'bg-green-50  border-green-200' },
  { label: 'DigiLocker Integrated', color: 'text-[#0F4C81]', bg: 'bg-blue-50   border-blue-200'  },
  { label: 'Blockchain Secured',    color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200'},
  { label: 'DPDPA Compliant',       color: 'text-[#FF9933]',  bg: 'bg-orange-50 border-orange-200'},
];

// ── Service Cards ─────────────────────────────────────────────────────────────
const SERVICES = [
  { icon: FileText,      label: 'View Land Records'   },
  { icon: Award,         label: 'Download RoR'        },
  { icon: ArrowLeftRight,label: 'Property Transfer'   },
  { icon: GitMerge,      label: 'Mutation Services'   },
  { icon: Users,         label: 'Succession Claims'   },
  { icon: Map,           label: 'GIS Land Maps'       },
];

// ── Security Indicators ───────────────────────────────────────────────────────
const SECURITY = [
  { icon: Lock,           label: '256-bit Encryption'       },
  { icon: CloudLightning, label: 'Government Cloud Hosted'  },
  { icon: Server,         label: 'NIC Infrastructure'       },
  { icon: Database,       label: 'Blockchain Audit Trail'   },
];

export default function LoginPage() {
  const router = useRouter();
  const [tab,         setTab]         = useState<Tab>('citizen');
  const [authMethod,  setAuthMethod]  = useState<AuthMethod>('digilocker');
  const [step,        setStep]        = useState<Step>('aadhaar');
  const [aadhaar,     setAadhaar]     = useState('');
  const [email,       setEmail]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [mobile,      setMobile]      = useState('');
  const [maskedPhone, setMasked]      = useState('');
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [loading,     setLoading]     = useState(false);

  function reset() { setStep('aadhaar'); setOtp(''); setError(''); setSuccess(''); setMasked(''); }
  function switchTab(t: Tab) { setTab(t); setAuthMethod('digilocker'); reset(); }

  async function handleRequestOTP() {
    const digits = aadhaar.replace(/\D/g, '');
    if (digits.length !== 12) { setError('Enter a valid 12-digit Aadhaar number'); return; }
    if (tab === 'officer' && !email.includes('@')) { setError('Enter a valid department email'); return; }
    setError(''); setLoading(true);
    try {
      const res = await requestOTP(aadhaar);
      setMasked(res.maskedPhone || 'XXXXXX1234');
      setStep('otp');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to send OTP'); }
    finally { setLoading(false); }
  }

  async function handleVerifyOTP() {
    if (otp.replace(/\D/g, '').length !== 6) { setError('Enter the complete 6-digit OTP'); return; }
    setError(''); setLoading(true);
    try {
      const user = tab === 'citizen'
        ? await verifyOTP(aadhaar, otp)
        : await officerLogin(aadhaar, email, otp);
      setSuccess(`Welcome, ${user.name}`);
      setTimeout(() => router.push(getRedirectPath(user.role)), 700);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Verification failed'); }
    finally { setLoading(false); }
  }

  async function handleDemoLogin(persona: string) {
    setLoading(true); setError('');
    try {
      const user = await demoLogin(persona);
      setSuccess(`Logged in as ${user.name}`);
      setTimeout(() => router.push(getRedirectPath(user.role)), 600);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Demo login failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
          ════════════════════════════════════════════════════════════════════ */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-12 h-[76px] grid grid-cols-3 items-center">

          {/* Left: Emblem */}
          <div className="flex items-center gap-3">
            <img
              src="/Government_of_India_logo.svg.webp"
              alt="Government of India Emblem"
              className="h-14 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          {/* Centre: BhumiChain */}
          <div className="text-center">
            <div className="text-[1.6rem] font-black text-[#0F4C81] tracking-tight leading-none">BhumiChain</div>
            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.18em] mt-1">National Land Registry Platform</div>
          </div>

          {/* Right: Digital India */}
          <div className="flex items-center justify-end">
            <img
              src="/Digital-India-Color.svg"
              alt="Digital India"
              className="h-11 w-auto object-contain hidden sm:block"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Tricolor strip */}
        <div className="h-[3px] w-full grid grid-cols-3">
          <div className="bg-[#FF9933]" />
          <div className="bg-white border-y border-gray-100" />
          <div className="bg-[#138808]" />
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
          ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: HERO ─────────────────────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-[58%] flex-col bg-white overflow-y-auto custom-scrollbar">
          <div className="px-14 pt-12 pb-10 flex-1 space-y-10">

            {/* Hero Heading */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#0F4C81]/20 bg-[#0F4C81]/5 text-[#0F4C81] text-xs font-bold uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-[#138808] animate-pulse" />
                Live on Hyperledger Fabric · UP Pilot
              </div>

              <h1 className="text-[3rem] font-black text-gray-900 leading-[1.1] tracking-tight">
                National Digital<br />
                <span className="text-[#0F4C81]">Land Registry</span>
              </h1>

              <p className="text-gray-500 text-[1.05rem] leading-relaxed max-w-[520px]">
                Secure access to your land records, property transfers, mutation applications,
                succession services and blockchain-verified ownership documents.
              </p>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-3">
              {TRUST_BADGES.map(b => (
                <div key={b.label} className={clsx('flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold', b.bg, b.color)}>
                  <CheckSquare className="w-4 h-4 shrink-0" />
                  {b.label}
                </div>
              ))}
            </div>

            {/* Hero Image */}
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg relative">
              <img
                src="/citizen_land_visual.png"
                alt="BhumiChain — Blockchain Land Registry"
                className="w-full h-[440px] object-cover object-top"
                onError={(e) => {
                  const p = e.currentTarget.parentElement!;
                  p.style.background = 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #BFDBFE 100%)';
                  p.style.minHeight = '240px';
                  e.currentTarget.style.display = 'none';
                }}
              />
              {/* Overlay badge */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="bg-white/90 backdrop-blur-sm border border-white/60 rounded-xl px-4 py-2.5 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Secured by</div>
                  <div className="text-sm font-black text-[#0F4C81]">Hyperledger Fabric v2.5</div>
                </div>
                <div className="bg-[#138808]/90 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-sm text-white text-center">
                  <div className="text-xs font-bold opacity-80 uppercase tracking-widest">Records</div>
                  <div className="text-sm font-black">2.3 Cr+</div>
                </div>
              </div>
            </div>

            {/* Service Cards */}
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Available Services</div>
              <div className="grid grid-cols-3 gap-3">
                {SERVICES.map(s => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 bg-white hover:border-[#0F4C81]/30 hover:bg-[#F8FAFF] hover:shadow-sm transition-all cursor-default text-center"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#0F4C81]/8 flex items-center justify-center">
                      <s.icon className="w-4.5 h-4.5 text-[#0F4C81]" style={{ width: 18, height: 18 }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 leading-tight">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Demo Quick Login */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2">Demo Quick Access</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_PERSONAS.map(p => (
                  <button
                    key={p.persona}
                    onClick={() => handleDemoLogin(p.persona)}
                    disabled={loading}
                    title={p.aadhaar ? `Aadhaar No: ${p.aadhaar}` : undefined}
                    style={{ backgroundColor: p.color }}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-white text-left hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
                  >
                    <div>
                      <div className="text-sm font-bold leading-tight">{p.label}</div>
                      <div className="text-xs opacity-75 mt-0.5 flex flex-col gap-0.5">
                        <span>{p.name}</span>
                        {p.aadhaar && <span className="font-mono text-[10px] opacity-90 tracking-wider" title={p.aadhaar}>Aadhaar: {p.aadhaar}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-60 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: AUTH PANEL ────────────────────────────────────────────── */}
        <div className="flex-1 lg:w-[42%] bg-[#F8FAFC] border-l border-gray-200 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="flex-1 flex flex-col justify-start py-10 px-6 sm:px-10">
            <div className="w-full max-w-[440px] mx-auto space-y-5">

              {/* ── Auth Card ──────────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                {/* Card top bar */}
                <div className="h-1 w-full grid grid-cols-3">
                  <div className="bg-[#FF9933]" />
                  <div className="bg-[#0F4C81]" />
                  <div className="bg-[#138808]" />
                </div>

                <div className="p-6 space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#0F4C81] flex items-center justify-center shadow-sm">
                      <Shield className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                    </div>
                    <div>
                      <h2 className="text-[1.05rem] font-black text-gray-900">Government Secure Access</h2>
                      <p className="text-[11px] text-gray-400 font-medium">Ministry of Rural Development</p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex bg-gray-100 rounded-xl p-1">
                    {(['citizen', 'officer'] as Tab[]).map(t => (
                      <button
                        key={t}
                        onClick={() => switchTab(t)}
                        className={clsx(
                          'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all',
                          tab === t
                            ? 'bg-white text-[#0F4C81] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        )}
                      >
                        {t === 'citizen' ? '🏠 Citizen' : '🏛️ Revenue Officer'}
                      </button>
                    ))}
                  </div>

                  {/* Status messages */}
                  {success && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                      <CheckCircle className="w-5 h-5 shrink-0 text-green-600" />
                      {success} — Redirecting…
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                      {error}
                    </div>
                  )}

                  {/* ── PRIMARY: DigiLocker ─────────────────────────────── */}
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Primary Login</div>
                    <button
                      onClick={() => router.push('/digilocker-login')}
                      className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border-2 border-[#0F4C81] bg-[#0F4C81] hover:bg-[#0a3566] text-white font-bold text-sm transition-all shadow-md shadow-[#0F4C81]/20 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-black text-[0.9rem]">Sign In / eSign with DigiLocker</div>
                        <div className="text-[11px] opacity-70 font-medium mt-0.5">Aadhaar-linked · Instant verification</div>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs text-gray-400 font-semibold">OR USE ANOTHER METHOD</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {/* ── AUTH METHOD SELECTOR ─────────────────────────────── */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'aadhaar',     icon: Fingerprint, label: 'Aadhaar OTP'  },
                      { key: 'mobile',      icon: Smartphone,  label: 'Mobile OTP'   },
                      { key: 'janparichay', icon: Award,       label: 'JanParichay'  },
                    ].map(m => (
                      <button
                        key={m.key}
                        onClick={() => { setAuthMethod(m.key as AuthMethod); reset(); }}
                        className={clsx(
                          'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all',
                          authMethod === m.key
                            ? 'border-[#0F4C81] bg-[#0F4C81]/5 text-[#0F4C81] shadow-sm'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                        )}
                      >
                        <m.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* ── AADHAAR OTP FLOW ─────────────────────────────────── */}
                  {authMethod === 'aadhaar' && tab === 'citizen' && (
                    <div className="space-y-3">
                      {step === 'aadhaar' ? (
                        <>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aadhaar Number</div>
                          <AadhaarInput value={aadhaar} onChange={setAadhaar} disabled={loading} />
                          <button
                            onClick={handleRequestOTP}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0F4C81] hover:bg-[#0a3566] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 shadow-sm"
                          >
                            {loading
                              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : <><ChevronRight className="w-4 h-4" /> Send Aadhaar OTP</>
                            }
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500">OTP sent to <span className="font-bold text-gray-800">{maskedPhone}</span></p>
                          <OTPInput value={otp} onChange={setOtp} disabled={loading} error={!!error} />
                          <button
                            onClick={handleVerifyOTP}
                            disabled={loading || otp.length < 6}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#138808] hover:bg-[#0f6b06] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                          >
                            {loading
                              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : <><Lock className="w-4 h-4" /> Verify & Authenticate</>
                            }
                          </button>
                          <button onClick={reset} className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors">← Change Aadhaar</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── MOBILE OTP ───────────────────────────────────────── */}
                  {authMethod === 'mobile' && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registered Mobile Number</div>
                      <div className="flex gap-2">
                        <div className="flex items-center px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">
                          +91
                        </div>
                        <input
                          type="tel"
                          maxLength={10}
                          value={mobile}
                          onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="XXXXX XXXXX"
                          className="flex-1 input font-mono tracking-widest"
                        />
                      </div>
                      <button
                        disabled={mobile.length < 10 || loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0F4C81] hover:bg-[#0a3566] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                      >
                        <Smartphone className="w-4 h-4" /> Send Mobile OTP
                      </button>
                    </div>
                  )}

                  {/* ── JANPARICHAY ──────────────────────────────────────── */}
                  {authMethod === 'janparichay' && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl border border-dashed border-[#0F4C81]/30 bg-[#0F4C81]/3 text-center space-y-2">
                        <Award className="w-8 h-8 text-[#0F4C81] mx-auto" />
                        <div className="text-sm font-bold text-gray-800">JanParichay / State SSO</div>
                        <p className="text-xs text-gray-500">Single Sign-On via National Identity Platform or your State Government portal</p>
                      </div>
                      <button className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-[#0F4C81] text-[#0F4C81] rounded-xl text-sm font-bold hover:bg-[#0F4C81]/5 transition-all">
                        <ChevronRight className="w-4 h-4" /> Continue with JanParichay
                      </button>
                      <button className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">
                        🏛️ Continue with State SSO (UP)
                      </button>
                    </div>
                  )}

                  {/* ── OFFICER FLOW ─────────────────────────────────────── */}
                  {tab === 'officer' && authMethod === 'aadhaar' && (
                    <div className="space-y-3">
                      {step === 'aadhaar' ? (
                        <>
                          <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Officer Aadhaar Number</div>
                            <AadhaarInput value={aadhaar} onChange={setAadhaar} disabled={loading} />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Department Email</div>
                            <input
                              type="email"
                              value={email}
                              onChange={e => setEmail(e.target.value)}
                              disabled={loading}
                              placeholder="name@up.gov.in"
                              className="input"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">Accepted: @up.gov.in · @gov.in · @nic.in</p>
                          </div>
                          <button
                            onClick={handleRequestOTP}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0F4C81] hover:bg-[#0a3566] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 shadow-sm"
                          >
                            {loading
                              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : <><Lock className="w-4 h-4" /> Send Officer OTP</>
                            }
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500">OTP sent to <span className="font-bold text-gray-800">{maskedPhone}</span></p>
                          <OTPInput value={otp} onChange={setOtp} disabled={loading} error={!!error} />
                          <button
                            onClick={handleVerifyOTP}
                            disabled={loading || otp.length < 6}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#138808] hover:bg-[#0f6b06] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                          >
                            {loading
                              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : <><Lock className="w-4 h-4" /> Officer Authenticate</>
                            }
                          </button>
                          <button onClick={reset} className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Security note */}
                  <div className="flex items-start gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
                    <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#138808]" />
                    100% Paperless · DPDPA 2023 Compliant · Aadhaar data never stored on BhumiChain servers
                  </div>
                </div>
              </div>

              {/* ── Security Indicators ─────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-2">
                {SECURITY.map(s => (
                  <div key={s.label} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <s.icon className="w-4 h-4 text-[#0F4C81] shrink-0" />
                    <span className="text-[11px] font-semibold text-gray-600">{s.label}</span>
                  </div>
                ))}
              </div>


            </div>
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className="border-t border-gray-200 bg-white px-8 py-4">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-gray-400 font-medium text-center">
              <span className="font-semibold text-gray-600">Government of India</span>
              <span>·</span>
              <span>Ministry of Rural Development</span>
              <span>·</span>
              <span>NIC</span>
              <span>·</span>
              <span>Digital India</span>
              <span>·</span>
              <span>Revenue Department, UP</span>
            </div>
            <div className="text-center text-[10px] text-gray-400 mt-1">
              © 2026 · v2.5 Hyperledger Fabric · Secured under IT Act 2000 & DPDPA 2023
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
