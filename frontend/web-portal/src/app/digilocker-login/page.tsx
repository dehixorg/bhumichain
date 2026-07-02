'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Cloud, Shield, CheckCircle, AlertCircle, ChevronRight, Lock, FileCheck, Smartphone } from 'lucide-react';
import clsx from 'clsx';
import { verifyOTP, getRedirectPath } from '@/lib/auth';

function formatAadhaar(value: string) {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 4) return clean;
  if (clean.length <= 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

function DigiLockerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAadhaar = searchParams ? searchParams.get('aadhaar') || '' : '';

  const [step, setStep]       = useState<'aadhaar' | 'otp' | 'success'>('aadhaar');
  const [aadhaar, setAadhaar] = useState(initialAadhaar || '999900010010');
  const [otp, setOtp]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handleSignIn() {
    const raw = aadhaar.replace(/\D/g, '');
    if (raw.length !== 12) {
      setError('Please enter a valid 12-digit Aadhaar Number');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 600);
  }

  function handleVerifyOTP() {
    if (otp !== '123456' && otp.replace(/\D/g, '').length !== 6) {
      setError('Please enter the 6-digit verification code (e.g. 123456)');
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
      const raw = aadhaar.replace(/\D/g, '');
      const user = await verifyOTP(raw || '999900010010', '123456');
      router.push(getRedirectPath(user.role));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* DigiLocker Official Logo Header */}
      <div className="flex flex-col items-center justify-center text-center space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-[#4b38b3] flex items-center justify-center shadow-md">
            <Cloud className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#4b38b3]">
              DigiLocker
            </h1>
          </div>
        </div>
        <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase">
          Document Wallet to Empower Citizens
        </p>
      </div>

      {/* Main White & Blue DigiLocker Card */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-7 sm:p-8 relative overflow-hidden text-gray-800">
        {/* Bottom purple/blue decorative line */}
        <div className="h-2 bg-gradient-to-r from-[#0066cc] via-[#4b38b3] to-[#8e2de2] absolute bottom-0 left-0 right-0" />

        {error && (
          <div className="mb-5 flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: AADHAAR INPUT */}
        {step === 'aadhaar' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Sign In to your account!
              </h2>
            </div>

            {/* Blue Active Button (No Username Section) */}
            <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
              <button
                type="button"
                className="bg-[#0066cc] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 tracking-wide"
              >
                <Smartphone className="w-4 h-4" />
                Mobile/Aadhaar
              </button>
            </div>

            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Aadhaar/Mobile Number*
                </label>
                <input
                  type="text"
                  value={formatAadhaar(aadhaar)}
                  onChange={(e) => setAadhaar(e.target.value)}
                  placeholder="XXXX - XXXX - XXXX"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-300 focus:border-[#0066cc] focus:ring-4 focus:ring-blue-100 text-gray-900 font-mono text-base font-semibold outline-none transition-all"
                />
                <p className="text-[11px] text-gray-500">
                  Enter your 12-digit Aadhaar number linked with DigiLocker
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={loading}
                  className="w-full bg-[#4caf50] hover:bg-[#43a047] text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all text-lg tracking-wide flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Sign In</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'otp' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-[#0066cc] px-2.5 py-1 rounded-md">
                2-Step Verification
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-2">
                Enter Verification OTP
              </h2>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Enter the 6-digit security code sent to your registered mobile number ending with <strong>XXXXXX1234</strong>.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-center justify-between">
              <span>Demo Pilot OTP:</span>
              <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-blue-300 text-blue-700">123456</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  6-Digit Security OTP*
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-300 focus:border-[#0066cc] focus:ring-4 focus:ring-blue-100 text-gray-900 font-mono text-center text-xl font-bold tracking-widest outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('aadhaar')}
                  className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 px-4 rounded-xl text-sm transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={loading}
                  className="w-2/3 bg-[#4caf50] hover:bg-[#43a047] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-base"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Verify & eSign</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS & ESIGN VERIFIED */}
        {step === 'success' && (
          <div className="space-y-6 text-center animate-fadeIn py-2">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-green-300 animate-bounce">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">
                eSign Successfully Verified!
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                Your digital signature and Aadhaar demographic KYC profile have been authorized by DigiLocker under DPDPA 2023.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Document Type:</span>
                <span className="font-bold text-gray-800">Aadhaar eSign & KYC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Aadhaar Number:</span>
                <span className="font-mono font-bold text-gray-800">{formatAadhaar(aadhaar)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-bold text-green-600 flex items-center gap-1">
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

      {/* Footer link back to main BhumiChain */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="text-xs text-gray-500 hover:text-gray-800 font-medium underline transition-colors"
        >
          ← Return to BhumiChain Officer Login
        </button>
      </div>
    </div>
  );
}

export default function DigiLockerLoginPage() {
  return (
    <div className="min-h-screen bg-[#f4f6f8] flex flex-col justify-between p-6 text-gray-800">
      {/* Top Bar */}
      <div className="max-w-4xl w-full mx-auto flex justify-between items-center py-2 border-b border-gray-200/80">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Government of Uttar Pradesh · Pilot
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full border border-green-300">
          <Shield className="w-3.5 h-3.5" /> 256-Bit TLS Encryption
        </div>
      </div>

      {/* Center Form Content */}
      <div className="flex-1 flex items-center justify-center py-8">
        <Suspense fallback={<div className="text-center text-gray-500 font-medium">Loading DigiLocker Gateway...</div>}>
          <DigiLockerForm />
        </Suspense>
      </div>

      {/* Bottom Footer */}
      <div className="max-w-4xl w-full mx-auto text-center py-4 border-t border-gray-200/80 text-[11px] text-gray-500 space-y-1">
        <div>DigiLocker is a flagship initiative of Ministry of Electronics & IT (MeitY) under Digital India programme.</div>
        <div>Compliant with Digital Personal Data Protection Act (DPDPA) 2023.</div>
      </div>
    </div>
  );
}
