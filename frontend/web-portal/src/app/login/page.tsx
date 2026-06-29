'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Zap, Lock, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import AadhaarInput from '@/components/auth/AadhaarInput';
import OTPInput from '@/components/auth/OTPInput';
import {
  requestOTP,
  verifyOTP,
  officerLogin,
  demoLogin,
  getRedirectPath,
} from '@/lib/auth';

type Tab = 'citizen' | 'officer';
type Step = 'aadhaar' | 'otp';

type DemoCredential = {
  persona: string;
  tab: Tab;
  role: string;
  name: string;
  aadhaar: string;
  email?: string;
};

const DEMO_PERSONAS = [
  { persona: 'tehsildar',        label: 'Tehsildar',  name: 'Amit Saxena',  color: 'bg-purple-700 hover:bg-purple-600' },
  { persona: 'circle_inspector', label: 'Kanungo',    name: 'Rajesh Verma', color: 'bg-blue-700   hover:bg-blue-600'   },
  { persona: 'patwari',          label: 'Patwari',    name: 'Vijay Singh',  color: 'bg-teal-700   hover:bg-teal-600'   },
  { persona: 'citizen',          label: 'Citizen',    name: 'Priya Kumar',  color: 'bg-brand-700  hover:bg-brand-600'  },
];

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    persona: 'citizen',
    tab: 'citizen',
    role: 'Citizen',
    name: 'Priya Kumar',
    aadhaar: '999900010010',
  },
  {
    persona: 'citizen_buyer',
    tab: 'citizen',
    role: 'Buyer',
    name: 'Arun Sharma',
    aadhaar: '999900010011',
  },
  {
    persona: 'citizen_heir1',
    tab: 'citizen',
    role: 'Heir',
    name: 'Suresh Yadav',
    aadhaar: '999900010012',
  },
  {
    persona: 'citizen_heir2',
    tab: 'citizen',
    role: 'Heir',
    name: 'Meena Devi',
    aadhaar: '999900010013',
  },
  {
    persona: 'tehsildar',
    tab: 'officer',
    role: 'Tehsildar',
    name: 'Amit Saxena',
    aadhaar: '999900010001',
    email: 'amit.saxena@up.gov.in',
  },
  {
    persona: 'circle_inspector',
    tab: 'officer',
    role: 'Kanungo / CI',
    name: 'Rajesh Verma',
    aadhaar: '999900010002',
    email: 'rajesh.verma@up.gov.in',
  },
  {
    persona: 'patwari',
    tab: 'officer',
    role: 'Patwari',
    name: 'Vijay Singh',
    aadhaar: '999900010003',
    email: 'vijay.singh@up.gov.in',
  },
];

function formatAadhaar(value: string) {
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab]           = useState<Tab>('citizen');
  const [step, setStep]         = useState<Step>('aadhaar');
  const [aadhaar, setAadhaar]   = useState('');
  const [email, setEmail]       = useState('');
  const [otp, setOtp]           = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');
  const isDev = process.env.NEXT_PUBLIC_FABRIC_MODE === 'mock';

  function reset() {
    setStep('aadhaar');
    setOtp('');
    setError('');
    setSuccess('');
    setMaskedPhone('');
  }

  function fillDemoCredential(credential: DemoCredential) {
    setTab(credential.tab);
    setStep('aadhaar');
    setAadhaar(credential.aadhaar);
    setEmail(credential.email ?? '');
    setOtp('');
    setError('');
    setSuccess('');
    setMaskedPhone('');
  }

  async function handleRequestOTP() {
    if (aadhaar.replace(/\D/g, '').length !== 12) {
      setError('Enter a valid 12-digit Aadhaar number');
      return;
    }
    if (tab === 'officer' && !email.includes('@')) {
      setError('Enter a valid department email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await requestOTP(aadhaar);
      setMaskedPhone(res.maskedPhone);
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (otp.replace(/\D/g, '').length !== 6) {
      setError('Enter the complete 6-digit OTP');
      return;
    }
    setError('');
    setLoading(true);
    try {
      let user;
      if (tab === 'citizen') {
        user = await verifyOTP(aadhaar, otp);
      } else {
        user = await officerLogin(aadhaar, email, otp);
      }
      setSuccess(`Welcome, ${user.name}`);
      setTimeout(() => router.push(getRedirectPath(user.role)), 800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(persona: string) {
    setLoading(true);
    setError('');
    try {
      const user = await demoLogin(persona);
      setSuccess(`Logged in as ${user.name}`);
      setTimeout(() => router.push(getRedirectPath(user.role)), 600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-950">

      {/* ── Left panel — branding ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-gray-900 via-brand-900 to-gray-950 border-r border-gray-800">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">भू</span>
          </div>
          <div>
            <div className="text-white font-bold text-lg tracking-tight">BhumiChain</div>
            <div className="text-brand-400 text-xs">भूमि अभिलेख प्रणाली</div>
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              India's Land Trust<br />
              <span className="text-brand-400">Infrastructure</span>
            </h1>
            <p className="mt-4 text-gray-400 text-lg leading-relaxed">
              Tamper-proof land records on Hyperledger Fabric v2.5.
              Gautam Buddha Nagar Pilot — Noida, Uttar Pradesh.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '500', label: 'Khataunis' },
              { value: '8',   label: 'Smart Contracts' },
              { value: '0',   label: 'Middlemen' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 bg-opacity-60 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-brand-400">{s.value}</div>
                <div className="text-gray-400 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="space-y-3">
            {[
              { icon: Shield, text: 'DPDPA 2023 Compliant — Aadhaar never stored' },
              { icon: Lock,   text: 'All mutations require multi-party eSign' },
              { icon: Zap,    text: 'Instant Encumbrance Certificate with QR' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-gray-400">
                <Icon className="w-4 h-4 text-brand-500 shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Demo quick-login */}
        {isDev && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-saffron-400 font-semibold uppercase tracking-wider">
              <Zap className="w-3 h-3" />
              Demo Quick Login
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_PERSONAS.map(p => (
                <button
                  key={p.persona}
                  onClick={() => handleDemoLogin(p.persona)}
                  disabled={loading}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors text-left',
                    p.color, loading && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <div className="font-semibold">{p.label}</div>
                  <div className="opacity-70">{p.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel — login form ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold">भू</span>
            </div>
            <span className="text-white font-bold text-lg">BhumiChain</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-100">Login to BhumiChain</h2>
            <p className="mt-1 text-gray-400 text-sm">भूमि अभिलेख पोर्टल — Noida, Uttar Pradesh</p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-900 border border-gray-800 p-1">
            {(['citizen', 'officer'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); reset(); }}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                  tab === t
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-gray-400 hover:text-gray-200',
                )}
              >
                {t === 'citizen' ? 'Citizen / नागरिक' : 'Officer / अधिकारी'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="card space-y-5">

            {/* Success state */}
            {success && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-900 bg-opacity-40 border border-green-700">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                <span className="text-green-300 text-sm font-medium">{success} — Redirecting...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-900 bg-opacity-40 border border-red-700">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            )}

            {step === 'aadhaar' ? (
              <>
                {isDev && (
                  <div className="rounded-xl border border-saffron-500/30 bg-saffron-500/10 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-saffron-300">
                          Demo Login Details
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Pick a person to autofill. OTP is <span className="font-mono text-saffron-300">123456</span>.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DEMO_CREDENTIALS
                        .filter((credential) => credential.tab === tab)
                        .map((credential) => (
                          <button
                            key={credential.persona}
                            type="button"
                            onClick={() => fillDemoCredential(credential)}
                            disabled={loading}
                            className={clsx(
                              'text-left rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 transition-colors',
                              'hover:border-saffron-500 hover:bg-gray-800',
                              loading && 'opacity-50 cursor-not-allowed',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-gray-100 truncate">{credential.name}</span>
                              <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">{credential.role}</span>
                            </div>
                            <div className="mt-1 font-mono text-xs text-saffron-300">
                              {formatAadhaar(credential.aadhaar)}
                            </div>
                            {credential.email && (
                              <div className="mt-0.5 text-xs text-gray-500 truncate">{credential.email}</div>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Aadhaar Number <span className="text-gray-500">(आधार संख्या)</span>
                  </label>
                  <AadhaarInput
                    value={aadhaar}
                    onChange={setAadhaar}
                    disabled={loading}
                    placeholder="XXXX-XXXX-XXXX"
                  />
                </div>

                {tab === 'officer' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">
                      Department Email <span className="text-gray-500">(सरकारी ईमेल)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={loading}
                      placeholder="name@up.gov.in"
                      className="input w-full"
                    />
                    <p className="text-xs text-gray-500">Accepted: @up.gov.in · @gov.in · @nic.in</p>
                  </div>
                )}

                <button
                  onClick={handleRequestOTP}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Send OTP <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Enter OTP sent to <span className="text-brand-400">{maskedPhone}</span>
                  </label>
                  <OTPInput
                    value={otp}
                    onChange={setOtp}
                    disabled={loading}
                    error={!!error}
                  />
                  {isDev && (
                    <p className="text-xs text-saffron-400">
                      Demo mode: OTP is always <strong>123456</strong>
                    </p>
                  )}
                </div>

                <button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length < 6}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Lock className="w-4 h-4" /> Login Securely</>
                  )}
                </button>

                <button
                  onClick={reset}
                  className="w-full text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Change Aadhaar number
                </button>
              </>
            )}

            {/* Privacy note */}
            <div className="pt-2 border-t border-gray-800 flex items-start gap-2 text-xs text-gray-500">
              <Lock className="w-3 h-3 mt-0.5 shrink-0 text-gray-600" />
              <span>
                Your Aadhaar number is <strong className="text-gray-400">never stored</strong> anywhere.
                Only a cryptographic hash (SHA-256) is used on-chain — compliant with DPDPA 2023.
              </span>
            </div>
          </div>

          {/* Mobile demo quick-login */}
          {isDev && (
            <div className="lg:hidden space-y-2">
              <p className="text-xs text-saffron-400 font-semibold uppercase tracking-wider">Demo Quick Login</p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_PERSONAS.map(p => (
                  <button
                    key={p.persona}
                    onClick={() => handleDemoLogin(p.persona)}
                    disabled={loading}
                    className={clsx('px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors', p.color)}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div className="opacity-70">{p.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
