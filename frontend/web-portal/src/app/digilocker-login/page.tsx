'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Shield, CheckCircle, AlertCircle, ChevronRight, FileCheck } from 'lucide-react';
import { verifyOTP, getRedirectPath } from '@/lib/auth';

function formatAadhaar(value: string) {
  const clean = value.replace(/\D/g, '').slice(0, 12);
  if (clean.length <= 4) return clean;
  if (clean.length <= 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`;
}

function DigiLockerForm() {
  const router = useRouter();

  const [step, setStep]         = useState<'signin' | 'otp' | 'success'>('signin');
  const [aadhaar, setAadhaar]   = useState('');
  const [pin, setPin]           = useState('');
  const [showPin, setShowPin]   = useState(false);
  const [otp, setOtp]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  function handleSignIn() {
    const raw = aadhaar.replace(/\D/g, '');
    if (raw.length !== 12) {
      setError('Please enter a valid 12-digit Aadhaar Number');
      return;
    }
    if (pin.length < 4) {
      setError('Please enter your 6 digit security PIN');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 700);
  }

  function handleVerifyOTP() {
    if (otp.length < 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('success');
    }, 700);
  }

  async function handleProceedToPortal() {
    setLoading(true);
    setError('');
    try {
      const raw = aadhaar.replace(/\D/g, '') || '999900010010';
      const user = await verifyOTP(raw, '123456');
      router.push(getRedirectPath(user.role));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[500px] mx-auto px-4">

      {/* ── DigiLocker Official Logo ─────────────────────── */}
      <div className="flex flex-col items-center mb-6">
        {/* Use the SVG/webp logo from public folder */}
        <img
          src="/DigiLocker.svg.webp"
          alt="DigiLocker"
          className="h-16 object-contain"
          onError={(e) => {
            // fallback if image fails
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            if (target.nextElementSibling) {
              (target.nextElementSibling as HTMLElement).style.display = 'flex';
            }
          }}
        />
        {/* Fallback text logo (hidden by default) */}
        <div className="hidden items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-[#4b38b3] flex items-center justify-center">
            <span className="text-white font-extrabold text-xl">D</span>
          </div>
          <span className="text-3xl font-extrabold text-[#4b38b3] tracking-tight">DigiLocker</span>
        </div>
      </div>

      {/* ── Main White Card ───────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Purple bottom accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-[#0066cc] via-[#4b38b3] to-[#8e2de2]" />

        <div className="px-8 pt-8 pb-8 space-y-5">

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── STEP 1: SIGN IN ── */}
          {step === 'signin' && (
            <div className="space-y-5">
              <h2 className="text-[22px] font-extrabold text-gray-900 tracking-tight">
                Sign In to your account!
              </h2>

              {/* Tab Row — Mobile/Aadhaar only (no Username) */}
              <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                <button
                  type="button"
                  className="bg-[#0066cc] text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md"
                >
                  <span className="text-base">📱</span>
                  Mobile/Aadhaar
                </button>
              </div>

              {/* Aadhaar Number Input */}
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatAadhaar(aadhaar)}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="Aadhaar/Mobile Number*"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-300 focus:border-[#0066cc] focus:ring-4 focus:ring-blue-100 text-gray-900 text-base font-semibold font-mono outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                />
              </div>

              {/* 6 Digit Security PIN Input */}
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 digit security PIN*"
                  className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-gray-300 focus:border-[#0066cc] focus:ring-4 focus:ring-blue-100 text-gray-900 text-base font-semibold font-mono outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPin ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>

              {/* Forgot PIN */}
              <div>
                <button type="button" className="text-[#0066cc] text-sm font-semibold hover:underline">
                  Forgot security PIN?
                </button>
              </div>

              {/* Sign In Button */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="w-full bg-[#4caf50] hover:bg-[#43a047] active:bg-[#388e3c] text-white font-bold py-4 rounded-xl shadow-md transition-all text-lg tracking-wide flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          )}

          {/* ── STEP 2: OTP VERIFICATION ── */}
          {step === 'otp' && (
            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest bg-blue-100 text-[#0066cc] px-3 py-1 rounded-lg inline-block">
                  2-Step Verification
                </span>
                <h2 className="text-[22px] font-extrabold text-gray-900 tracking-tight mt-3">
                  Enter Verification Code
                </h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  An OTP has been sent to your Aadhaar-linked mobile number ending with <strong>XXXXXX1234</strong>.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-800 flex items-center justify-between">
                <span className="font-semibold">Demo Pilot OTP:</span>
                <span className="font-mono font-extrabold text-sm bg-white px-3 py-1 rounded-lg border border-blue-300 text-[#0066cc]">123456</span>
              </div>

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-300 focus:border-[#0066cc] focus:ring-4 focus:ring-blue-100 text-gray-900 text-center text-2xl font-extrabold font-mono tracking-widest outline-none transition-all placeholder:text-gray-400 placeholder:font-normal placeholder:text-base placeholder:tracking-normal"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('signin'); setError(''); }}
                  className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl text-sm transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length < 6}
                  className="w-2/3 bg-[#4caf50] hover:bg-[#43a047] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md transition-all text-base flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Verify & eSign'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: eSIGN SUCCESS ── */}
          {step === 'success' && (
            <div className="space-y-5 text-center py-2">
              {/* Green check */}
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner border-2 border-green-300">
                <CheckCircle className="w-11 h-11 text-green-600" />
              </div>

              <div>
                <h2 className="text-[22px] font-extrabold text-gray-900 tracking-tight">
                  eSign Successfully Verified!
                </h2>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Your digital signature and Aadhaar KYC profile have been authorized by DigiLocker under DPDPA 2023.
                </p>
              </div>

              {/* Details box */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-left text-xs space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-500 font-semibold">Document Type:</span>
                  <span className="font-bold text-gray-900">Aadhaar eSign & KYC</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-500 font-semibold">Aadhaar Number:</span>
                  <span className="font-mono font-bold text-gray-900">{formatAadhaar(aadhaar) || 'XXXX-XXXX-XXXX'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Authorization Status:</span>
                  <span className="font-bold text-green-600 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5" /> Approved & Signed
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleProceedToPortal}
                disabled={loading}
                className="w-full bg-[#0066cc] hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 text-base active:scale-[0.99]"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Proceed to BhumiChain Portal <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
            </div>
          )}

        </div>

        {/* Purple bottom bar */}
        <div className="h-[3px] bg-gradient-to-r from-[#0066cc] via-[#4b38b3] to-[#8e2de2]" />
      </div>

      {/* Don't have account / back link */}
      <p className="text-center text-xs text-gray-500 mt-5">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="text-[#0066cc] font-semibold hover:underline"
        >
          Sign Up
        </button>
      </p>
    </div>
  );
}

export default function DigiLockerLoginPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f2f5' }}>


      {/* ── Center Content ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center py-10 px-4">
        <Suspense fallback={
          <div className="text-center text-gray-500 font-semibold text-sm">Loading DigiLocker Gateway...</div>
        }>
          <DigiLockerForm />
        </Suspense>
      </div>


    </div>
  );
}
