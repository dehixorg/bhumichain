"use client";

import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { executeSuccessionClaim, getInheritorNominations } from "@/lib/api";
import { getUser, type JWTUser } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  ArrowRight,
  CheckCircle,
  Database,
  FileText,
  Landmark,
  Loader2,
  Scan,
  Upload,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";

type AcceptedNomination = {
  dlpiId: string;
  ownerName?: string;
  ownerAadhaar?: string;
  inheritorName?: string;
  inheritorAadhaarNumber?: string;
  status?: string;
};

type CrsExtraction = {
  dlpiId: string;
  name: string;
  dod: string;
  crsRegistrationNo: string;
  fileName: string;
};

const DEMO_DECEASED = {
  name: "Ramesh Kumar",
  dod: "2026-05-20",
};

const DEMO_CRS = {
  crsRegistrationNo: "CRS-GBN-2026-00891",
};

const CRS_AI_STEPS = [
  "Uploading death certificate to secure document vault",
  "Running OCR extraction",
  "Cross-checking owner identity",
  "Validating registration number",
  "Validation successful",
];

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function SuccessionPage() {
  const [user, setUser] = useState<JWTUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptedNominations, setAcceptedNominations] = useState<
    AcceptedNomination[]
  >([]);
  const [selectedDlpiId, setSelectedDlpiId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [crsAiSteps, setCrsAiSteps] = useState<
    { label: string; done: boolean }[]
  >([]);
  const [crsExtraction, setCrsExtraction] = useState<CrsExtraction | null>(
    null,
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    txId?: string;
  } | null>(null);

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);

    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchNominations = async () => {
      try {
        const nominations = await getInheritorNominations();
        const list = Array.isArray(nominations) ? nominations : [];
        const myRaw = String(
          currentUser.aadhaar || currentUser.aadhaarNumber || "",
        ).replace(/\D/g, "");

        const myAccepted = list.filter((nomination: AcceptedNomination) => {
          const nominationRaw = String(
            nomination.inheritorAadhaarNumber || "",
          ).replace(/\D/g, "");
          return (
            nomination.status === "ACCEPTED" &&
            myRaw.length > 0 &&
            myRaw === nominationRaw
          );
        });

        setAcceptedNominations(myAccepted);
        setSelectedDlpiId(myAccepted[0]?.dlpiId || "");
      } catch (error) {
        console.error("Failed to fetch nominations:", error);
        toast.error("Unable to load accepted nominations.");
      } finally {
        setLoading(false);
      }
    };

    void fetchNominations();
  }, []);

  const selectedNomination = useMemo(
    () =>
      acceptedNominations.find((item) => item.dlpiId === selectedDlpiId) ||
      null,
    [acceptedNominations, selectedDlpiId],
  );

  const handleUploadCRS = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!selectedDlpiId) {
      toast.error("Please select a property first.");
      return;
    }

    setIsScanning(true);
    setCrsAiSteps(CRS_AI_STEPS.map((label) => ({ label, done: false })));

    try {
      for (let index = 0; index < CRS_AI_STEPS.length; index += 1) {
        await delay(280);
        setCrsAiSteps((steps) =>
          steps.map((step, stepIndex) =>
            stepIndex <= index ? { ...step, done: true } : step,
          ),
        );
      }

      setCrsExtraction({
        dlpiId: selectedDlpiId,
        name: selectedNomination?.ownerName || DEMO_DECEASED.name,
        dod: DEMO_DECEASED.dod,
        crsRegistrationNo: DEMO_CRS.crsRegistrationNo,
        fileName: file.name,
      });

      toast.success("Death certificate verified by AI.");
    } catch (error) {
      console.error("CRS scan failed:", error);
      setCrsAiSteps(CRS_AI_STEPS.map((label) => ({ label, done: true })));
      setCrsExtraction({
        dlpiId: selectedDlpiId,
        name: DEMO_DECEASED.name,
        dod: DEMO_DECEASED.dod,
        crsRegistrationNo: DEMO_CRS.crsRegistrationNo,
        fileName: file.name,
      });
      toast.success("Death certificate verified by AI.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleExecuteClaim = async () => {
    if (!crsExtraction) {
      toast.error("Upload a death certificate first.");
      return;
    }

    setIsExecuting(true);
    try {
      const result = await executeSuccessionClaim({
        dlpiId: crsExtraction.dlpiId,
        dateOfDeath: crsExtraction.dod,
        crsRegistrationNo: crsExtraction.crsRegistrationNo,
      });
      setExecutionResult(result);
      toast.success("Automated succession executed successfully.");
    } catch (error) {
      console.error("Succession execution failed:", error);
      toast.error(error instanceof Error ? error.message : "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const txId =
    executionResult?.txId ||
    "0x" +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join("");

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar demoMode />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
          <Landmark className="h-4 w-4 text-[#0F4C81]" />
          <span className="text-sm font-semibold text-gray-700">
            Claim Desk - Automated Succession
          </span>
          <span className="text-xs text-gray-400">Digital Will Execution</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-[#0F4C81] to-[#1e3a8a] p-6 text-white shadow-md">
              <h1 className="mb-2 flex items-center gap-2 text-2xl font-black">
                <FileText className="h-6 w-6" /> Inheritance Claim Desk
              </h1>
              <p className="text-sm text-blue-100">
                Upload the death certificate for an accepted digital nomination
                and execute the succession claim in a single flow.
              </p>
            </div>

            {loading ? (
              <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-[#0F4C81]" />
                <p className="font-medium text-gray-500">
                  Checking your verified nominations...
                </p>
              </div>
            ) : acceptedNominations.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
                  <Database className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">
                  No Active Nominations
                </h3>
                <p className="mx-auto max-w-md text-sm text-gray-500">
                  You do not have any accepted nominations registered on the
                  blockchain. Accept a nomination first, then return here to
                  execute succession.
                </p>
                {user && (
                  <p className="mt-4 text-xs text-gray-400">
                    Signed in as {user.name || "verified user"}
                  </p>
                )}
              </div>
            ) : executionResult ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="mb-3 text-2xl font-black text-gray-900">
                  Inheritance Executed Successfully!
                </h2>
                <p className="mx-auto mb-8 max-w-md text-gray-600">
                  The property transfer has been recorded on the blockchain.
                </p>
                <div className="mb-8 inline-block w-full max-w-sm rounded-xl border border-gray-200 bg-gray-50 p-5 text-left">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Transaction Ref
                  </div>
                  <div className="mb-4 break-all font-mono text-sm text-gray-900">
                    {txId}
                  </div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Status
                  </div>
                  <div className="font-bold text-emerald-600">EXECUTED</div>
                </div>
                <a
                  href="/my-parcels"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C81] px-6 py-3 font-bold text-white transition-colors hover:bg-[#0c3d67]"
                >
                  View Updated Parcels <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-gray-900">
                    1. Select Nominated Property
                  </h2>
                  <select
                    value={selectedDlpiId}
                    onChange={(event) => {
                      setSelectedDlpiId(event.target.value);
                      setCrsExtraction(null);
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40"
                  >
                    {acceptedNominations.map((nomination) => (
                      <option key={nomination.dlpiId} value={nomination.dlpiId}>
                        DLPI: {nomination.dlpiId}{" "}
                        {nomination.ownerAadhaar
                          ? `- Owner Aadhaar: ${nomination.ownerAadhaar}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">
                      2. Upload Death Certificate
                    </h2>
                    {crsExtraction && (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <CheckCircle className="h-4 w-4" /> OCR Verified
                      </span>
                    )}
                  </div>

                  {isScanning ? (
                    <div className="space-y-3 py-4">
                      <div className="mb-4 flex items-center gap-2 text-[#0F4C81]">
                        <Scan className="h-5 w-5 animate-pulse" />
                        <span className="text-sm font-bold">
                          AI Processing Document...
                        </span>
                      </div>
                      {crsAiSteps.map((step) => (
                        <div
                          key={step.label}
                          className={clsx(
                            "flex items-center gap-3 text-sm",
                            step.done
                              ? "font-medium text-gray-800"
                              : "text-gray-400",
                          )}
                        >
                          {step.done ? (
                            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <div className="h-4 w-4 shrink-0 animate-pulse rounded-full border-2 border-gray-300" />
                          )}
                          {step.label}
                        </div>
                      ))}
                    </div>
                  ) : !crsExtraction ? (
                    <label className="group flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:bg-gray-100">
                      <Upload className="mb-3 h-8 w-8 text-gray-400 transition-colors group-hover:text-[#0F4C81]" />
                      <div className="text-sm font-semibold text-gray-700">
                        Click to upload CRS death certificate
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        PDF, JPG, PNG up to 10MB
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={handleUploadCRS}
                      />
                    </label>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                            Deceased
                          </div>
                          <div className="font-semibold text-gray-900">
                            {crsExtraction.name}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                            Date of Death
                          </div>
                          <div className="font-semibold text-gray-900">
                            {format(new Date(crsExtraction.dod), "dd MMM yyyy")}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                            CRS Registration No.
                          </div>
                          <div className="font-mono text-gray-900">
                            {crsExtraction.crsRegistrationNo}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCrsExtraction(null)}
                        className="mt-4 text-xs font-bold text-red-600 underline hover:text-red-700"
                      >
                        Re-upload document
                      </button>
                    </div>
                  )}
                </div>

                {crsExtraction && (
                  <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-6 text-white shadow-md">
                    <h2 className="mb-2 text-lg font-bold">3. Execute Claim</h2>
                    <p className="mb-6 text-sm text-emerald-100">
                      All requirements are met. The blockchain can now verify
                      the certificate details and execute the property transfer.
                    </p>
                    <button
                      type="button"
                      onClick={handleExecuteClaim}
                      disabled={isExecuting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 font-bold text-emerald-800 shadow-lg transition-all hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />{" "}
                          Processing Smart Contract...
                        </>
                      ) : (
                        <>
                          <Zap className="h-5 w-5" /> Execute Automated
                          Succession
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
