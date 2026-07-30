'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  Send,
  Copy,
  Check,
  User,
  Plus,
  Trash2,
  Edit2,
  Search,
  Paperclip,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  ExternalLink,
  BookOpen,
  FileText,
  ShieldCheck,
  Scale,
  ArrowUpRight,
  Sidebar as SidebarIcon,
  ArrowLeft,
  Home,
  MessageSquare,
  Pin,
  PinOff,
  CheckCircle2,
  AlertTriangle,
  Compass,
  FileCheck2,
  Landmark,
  RotateCw,
  ChevronDown,
} from 'lucide-react';
import axios from 'axios';
import { getUser, isOfficer, JWTUser } from '@/lib/auth';

const ROLE_LABEL: Record<string, string> = {
  circle_officer: 'Circle Officer',
  circle_inspector: 'Kanungo / CI',
  karmachari: 'Patwari (Karmachari)',
  citizen: 'Citizen',
  kotwal: 'Kotwal',
  anchalNirikshak: 'Anchal Nirikshak',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  attachment?: {
    name: string;
    size: string;
    contentPreview: string;
  };
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
  isPinned?: boolean;
}

export interface BhumiBotUIProps {
  className?: string;
}

const uid = () => Math.random().toString(36).slice(2, 11);

// ─── Brand Avatars ────────────────────────────────────────────────────────────

function BhumiBotAvatar({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#0F4C81" />
      <text x="16" y="22" fontFamily="serif" fontSize="17" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">भू</text>
    </svg>
  );
}

function BhumiBotAvatarInverted({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#FFFFFF" />
      <text x="16" y="22" fontFamily="serif" fontSize="17" fontWeight="bold" fill="#0F4C81" textAnchor="middle">भू</text>
    </svg>
  );
}

// ─── 24 Distinct Land Legal Recommendation Questions (6 Batches of 4) ─────────────

const NEW_LEGAL_RECOMMENDATIONS_POOL = [
  // --- Batch 1: Succession & Inheritance ---
  {
    category: 'Inheritance Law',
    question: 'What are the coparcenary inheritance rights of a daughter under Hindu Succession Act 2005 after Supreme Court Vineeta Sharma ruling?',
    icon: Scale,
  },
  {
    category: 'Inheritance Law',
    question: 'How is agricultural land distributed among Class-I legal heirs when a landowner dies intestate without a Will?',
    icon: BookOpen,
  },
  {
    category: 'Inheritance Law',
    question: 'Is a registered Will sufficient for revenue land mutation, or is a Probate/Succession Certificate mandatory?',
    icon: FileText,
  },
  {
    category: 'Property Partition',
    question: 'What is the legal difference between a registered Partition Deed and an oral Family Settlement (Khandani Batwara)?',
    icon: Scale,
  },

  // --- Batch 2: Property Transfer & Registration ---
  {
    category: 'Property Transfer',
    question: 'Why does a registered Sale Deed not automatically transfer revenue ownership without Jamabandi land mutation?',
    icon: Landmark,
  },
  {
    category: 'Property Transfer',
    question: 'Can a property be legally sold using a General Power of Attorney (GPA) under Suraj Lamp Supreme Court ruling?',
    icon: FileCheck2,
  },
  {
    category: 'Stamp & Registration',
    question: 'What happens if a sale deed is impounded under Section 47A for undervaluation below MVR guideline rates?',
    icon: ShieldCheck,
  },
  {
    category: 'Revenue Appeals',
    question: 'How can a fraudulent revenue land mutation entry be challenged or cancelled before the DCLR / Revenue Collector?',
    icon: AlertTriangle,
  },

  // --- Batch 3: Title Audit & Land Records ---
  {
    category: 'Title Audit',
    question: 'How do I verify a 12-year chain of title ownership using Jamabandi, Khasra, and registered sale deeds?',
    icon: Compass,
  },
  {
    category: 'Revenue Records',
    question: 'What legal procedure resolves discrepancies between Khatauni area records and physical survey plot boundaries?',
    icon: Landmark,
  },
  {
    category: 'Title Audit',
    question: 'How can I verify whether a land parcel belongs to Gram Sabha, Gair Mazarua, or public easement rights?',
    icon: AlertTriangle,
  },
  {
    category: 'Document Audit',
    question: 'What legal details and defect indicators should I check when analyzing a land record document text?',
    icon: FileCheck2,
  },

  // --- Batch 4: Regulations & Ceiling Laws ---
  {
    category: 'Land Regulations',
    question: 'What ceiling limits and agricultural land purchasing restrictions apply to non-farmers under state revenue codes?',
    icon: ShieldCheck,
  },
  {
    category: 'Land Regulations',
    question: 'How to verify Non-Agricultural (NA) land conversion permission and layout approval before plot purchase?',
    icon: Landmark,
  },
  {
    category: 'Land Regulations',
    question: 'What statutory permissions are required before purchasing tribal or Scheduled Tribe (ST) land under land revenue acts?',
    icon: ShieldCheck,
  },
  {
    category: 'Revenue Records',
    question: 'What is the statutory process to obtain certified copies of Khatiyan, Jamabandi, and Khasra map from Revenue Circle Office?',
    icon: FileText,
  },

  // --- Batch 5: Encumbrance & Mortgage Search ---
  {
    category: 'Encumbrance Search',
    question: 'How do I verify registered bank mortgages, court stay orders, or charges via Encumbrance Certificate (EC)?',
    icon: ShieldCheck,
  },
  {
    category: 'Encumbrance Search',
    question: 'What legal procedure is required to remove or discharge a bank mortgage lien from revenue Jamabandi records?',
    icon: ShieldCheck,
  },
  {
    category: 'Litigation Risk',
    question: 'How can a prospective buyer verify whether a property is involved in pending civil court litigation or injunctions?',
    icon: AlertTriangle,
  },
  {
    category: 'Encumbrance Search',
    question: 'What is CERSAI registration and how does it protect property buyers against fraudulent multi-bank loans?',
    icon: ShieldCheck,
  },

  // --- Batch 6: Boundary Disputes & Land Rights ---
  {
    category: 'Boundary Dispute',
    question: 'What is the official legal procedure for boundary demarcation (Napi) and removing illegal land encroachment?',
    icon: Landmark,
  },
  {
    category: 'Dispute Risk',
    question: 'What legal conditions must be proven under Article 65 Limitation Act to claim or defend 12-year Adverse Possession?',
    icon: Scale,
  },
  {
    category: 'Land Rights',
    question: 'Does a co-sharer or adjoining tenant have legal pre-emption rights to buy land before third-party purchasers?',
    icon: Compass,
  },
  {
    category: 'Boundary Dispute',
    question: 'How can an illegal boundary wall obstruction or easement right violation be removed via Circle Officer proceedings?',
    icon: AlertTriangle,
  },
];

export default function BhumiBotUI({ className }: BhumiBotUIProps) {
  const [mounted, setMounted] = useState(false);

  // Threads state with localStorage persistence
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [portalLink, setPortalLink] = useState('/my-parcels');

  const [user, setUser] = useState<JWTUser | null>(null);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setUser(u);
  }, []);

  const userInitials = user?.name
    ? user.name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  // Popover state for collapsed sidebar icons
  const [activeFlyout, setActiveFlyout] = useState<'pinned' | 'recents' | 'search' | null>(null);

  // Input & Attachment state
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<{
    name: string;
    size: string;
    contentPreview: string;
    file?: File;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUserStorageKey = useCallback(() => {
    if (typeof window === 'undefined') return 'bhumibot_v5_threads_guest';
    const user = getUser();
    if (!user) return 'bhumibot_v5_threads_guest';
    const rawId = user.aadhaarNumber || user.aadhaarId || user.aadhaar || user.name || user.role || 'user';
    const cleanId = String(rawId).replace(/[^a-zA-Z0-9]/g, '_');
    return `bhumibot_v5_threads_${user.role || 'user'}_${cleanId}`;
  }, []);

  useEffect(() => {
    const user = getUser();
    if (user && isOfficer()) {
      setPortalLink('/officer-dashboard');
    } else {
      setPortalLink('/my-parcels');
    }
  }, []);

  useEffect(() => {
    const key = getUserStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed: ChatThread[] = JSON.parse(saved, (k, value) => {
          if (k === 'createdAt' || k === 'updatedAt' || k === 'timestamp') {
            return new Date(value);
          }
          return value;
        });

        if (parsed.length > 0) {
          setThreads(parsed);
          setActiveThreadId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.error('Error loading threads for user key:', key, e);
    }

    const defaultThread: ChatThread = {
      id: uid(),
      title: 'New Legal Analysis',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      isPinned: false,
    };
    setThreads([defaultThread]);
    setActiveThreadId(defaultThread.id);
  }, [getUserStorageKey]);

  useEffect(() => {
    if (threads.length > 0) {
      const key = getUserStorageKey();
      localStorage.setItem(key, JSON.stringify(threads));
    }
  }, [threads, getUserStorageKey]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const messages = activeThread?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const heroTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomTextareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const [batchIndex, setBatchIndex] = useState(0);

  const shuffleRecommendations = useCallback(() => {
    setBatchIndex((prev) => (prev + 1) % 6);
  }, []);

  const currentRecommendations = React.useMemo(() => {
    const start = (batchIndex * 4) % NEW_LEGAL_RECOMMENDATIONS_POOL.length;
    return NEW_LEGAL_RECOMMENDATIONS_POOL.slice(start, start + 4);
  }, [batchIndex]);

  // Reset input, attachment, and adjust textarea height on thread switch
  useEffect(() => {
    setAttachment(null);
    setInput('');
    if (heroTextareaRef.current) adjustTextareaHeight(heroTextareaRef.current);
    if (bottomTextareaRef.current) adjustTextareaHeight(bottomTextareaRef.current);
  }, [activeThreadId]);

  useEffect(() => {
    if (heroTextareaRef.current) adjustTextareaHeight(heroTextareaRef.current);
    if (bottomTextareaRef.current) adjustTextareaHeight(bottomTextareaRef.current);
  }, [input]);

  const handleNewChat = () => {
    if (speakingId) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
    }
    const newThread: ChatThread = {
      id: uid(),
      title: 'New Legal Analysis',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      isPinned: false,
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setInput('');
    setAttachment(null);
    setActiveFlyout(null);
  };

  const handleTogglePin = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, isPinned: !t.isPinned } : t))
    );
  };

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = threads.filter((t) => t.id !== threadId);
    if (filtered.length === 0 || activeThreadId === threadId) {
      const newThread: ChatThread = {
        id: uid(),
        title: 'New Legal Analysis',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
        isPinned: false,
      };
      setThreads([...filtered, newThread]);
      setActiveThreadId(newThread.id);
    } else {
      setThreads(filtered);
    }
  };

  const handleStartRename = (thread: ChatThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title);
  };

  const handleSaveRename = (threadId: string) => {
    if (editingTitle.trim()) {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, title: editingTitle.trim() } : t))
      );
    }
    setEditingThreadId(null);
  };

  const [isExtractingDoc, setIsExtractingDoc] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict file type restriction: PDF, Image (PNG, JPG, JPEG, WEBP), and Word (DOC, DOCX)
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'];
    const fileNameLower = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some((ext) => fileNameLower.endsWith(ext)) ||
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      file.type.includes('word') ||
      file.type.includes('officedocument');

    if (!isAllowed) {
      alert('Invalid file format. Only PDF (.pdf), Image (.png, .jpg, .jpeg, .webp), and Word documents (.doc, .docx) can be uploaded.');
      e.target.value = '';
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    setAttachment({
      name: file.name,
      size: sizeFormatted,
      contentPreview: `[Attached Property Document: ${file.name} (${sizeFormatted})]`,
      file: file,
    });

    e.target.value = '';
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#•-]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = useCallback(
    async (queryOverride?: string) => {
      const textToSend = queryOverride || input;
      if ((!textToSend.trim() && !attachment) || isTyping || !activeThreadId) return;

      const currentAttachment = attachment;
      setInput('');
      setAttachment(null);

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        text: textToSend.trim() || (currentAttachment ? `Analyze attached property document: ${currentAttachment.name}` : ''),
        timestamp: new Date(),
        attachment: currentAttachment ? {
          name: currentAttachment.name,
          size: currentAttachment.size,
          contentPreview: currentAttachment.contentPreview,
        } : undefined,
      };

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === activeThreadId) {
            const newTitle = t.messages.length === 0
              ? textToSend.slice(0, 32) || currentAttachment?.name || 'Legal Analysis'
              : t.title;

            return {
              ...t,
              title: newTitle,
              updatedAt: new Date(),
              messages: [...t.messages, userMsg],
            };
          }
          return t;
        })
      );

      setIsTyping(true);

      try {
        const historyPayload = messages.map((m) => ({
          role: m.role,
          content: m.text,
        }));

        let res;

        if (currentAttachment && currentAttachment.file) {
          // Pass document file directly via FormData to /api/bhumibot/chat for da2 analysis
          const formData = new FormData();
          formData.append('file', currentAttachment.file);
          formData.append('query', textToSend.trim() || 'Analyze attached property document and provide comprehensive legal details.');
          formData.append('conversation_history', JSON.stringify(historyPayload));

          res = await axios.post('/api/bhumibot/chat', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 0, // 0 = unlimited timeout for multi-page AI vision & legal extraction
          });
        } else {
          res = await axios.post('/api/bhumibot/chat', {
            query: textToSend.trim(),
            conversation_history: historyPayload,
          });
        }

        const data = res.data;

        let responseText = data.answer || 'Unable to process your legal query at this moment.';
        
        if (data.sources && data.sources.length > 0) {
          responseText += '\n\n## Verified Statutory & Precedent Sources\n';
          data.sources.forEach((s: string) => {
            responseText += `- ${s}\n`;
          });
        }

        if (data.suggested_actions && data.suggested_actions.length > 0) {
          responseText += '\n\n## Recommended Next Steps\n';
          data.suggested_actions.forEach((act: string) => {
            responseText += `- ${act}\n`;
          });
        }

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          text: responseText,
          timestamp: new Date(),
        };

        setThreads((prev) =>
          prev.map((t) =>
            t.id === activeThreadId
              ? { ...t, updatedAt: new Date(), messages: [...t.messages, assistantMsg] }
              : t
          )
        );
      } finally {
        setIsTyping(false);
      }
    },
    [input, attachment, isTyping, activeThreadId, messages]
  );

  const pinnedThreads = threads.filter((t) => t.isPinned);
  const unpinnedThreads = threads.filter((t) => !t.isPinned);

  const filteredPinned = pinnedThreads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredUnpinned = unpinnedThreads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!mounted) {
    return <div className={clsx('h-full w-full bg-[#F8FAFC]', className)} />;
  }

  return (
    <div className={clsx('flex h-full w-full bg-[#F8FAFC] font-sans text-slate-900 antialiased rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden relative', className)}>
      
      {/* ── 1. Royal Navy Sidebar (#0F4C81) with Subtle Tiranga Accent ── */}
      <div
        className={clsx(
          'bg-[#0F4C81] text-white flex flex-col border-r border-[#0F4C81]/30 transition-all duration-300 shrink-0 z-20 shadow-xl overflow-visible relative',
          sidebarOpen ? 'w-64 md:w-72' : 'w-14'
        )}
      >
        {/* Sleek Top Indian Tricolor (Tiranga) Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808] shrink-0" />

        {!sidebarOpen ? (
          <div className="flex flex-col items-center py-3 h-full relative justify-between">
            <div className="flex flex-col items-center space-y-3.5">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-white/15 rounded-xl text-white transition cursor-pointer"
                title="Expand Sidebar"
              >
                <BhumiBotAvatarInverted className="w-6 h-6 rounded-md shadow-sm" />
              </button>

              <button
                onClick={handleNewChat}
                className="p-2.5 hover:bg-white/15 rounded-xl text-white/90 hover:text-white transition cursor-pointer relative group"
                title="New Legal Analysis"
              >
                <Plus className="w-5 h-5" />
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#FF9933]" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setActiveFlyout(activeFlyout === 'search' ? null : 'search')}
                  onMouseEnter={() => setActiveFlyout('search')}
                  className="p-2.5 hover:bg-white/15 rounded-xl text-white/90 hover:text-white transition cursor-pointer"
                  title="Search History"
                >
                  <Search className="w-5 h-5" />
                </button>

                {activeFlyout === 'search' && (
                  <div
                    onMouseLeave={() => setActiveFlyout(null)}
                    className="absolute left-14 top-0 w-64 bg-[#1E293B] border border-slate-700 text-white rounded-2xl shadow-2xl p-3 z-50 space-y-2"
                  >
                    <div className="font-bold text-xs text-white">Search History</div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type query title..."
                      autoFocus
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-400 focus:outline-none"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                      {threads
                        .filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setActiveThreadId(t.id);
                              setActiveFlyout(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-200 truncate block"
                          >
                            {t.title}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setActiveFlyout(activeFlyout === 'pinned' ? null : 'pinned')}
                  onMouseEnter={() => setActiveFlyout('pinned')}
                  className={clsx(
                    'p-2.5 rounded-xl transition cursor-pointer',
                    pinnedThreads.length > 0 ? 'text-amber-300 hover:bg-white/15' : 'text-white/90 hover:bg-white/15'
                  )}
                  title="Pinned Chats"
                >
                  <Pin className="w-5 h-5" />
                </button>

                {activeFlyout === 'pinned' && (
                  <div
                    onMouseLeave={() => setActiveFlyout(null)}
                    className="absolute left-14 top-0 w-64 bg-[#262626] border border-zinc-700 text-white rounded-2xl shadow-2xl p-3.5 z-50 space-y-2.5"
                  >
                    <div className="font-bold text-xs text-zinc-200 tracking-wide">Pinned</div>
                    {pinnedThreads.length === 0 ? (
                      <div className="text-[11px] text-zinc-400 py-1">No pinned analyses yet.</div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                        {pinnedThreads.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setActiveThreadId(t.id);
                              setActiveFlyout(null);
                            }}
                            className="w-full text-left px-2.5 py-2 hover:bg-zinc-800 rounded-xl text-xs text-zinc-200 group transition"
                          >
                            <span className="truncate block">{t.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setActiveFlyout(activeFlyout === 'recents' ? null : 'recents')}
                  onMouseEnter={() => setActiveFlyout('recents')}
                  className="p-2.5 hover:bg-white/15 rounded-xl text-white/90 hover:text-white transition cursor-pointer"
                  title="Recents"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>

                {activeFlyout === 'recents' && (
                  <div
                    onMouseLeave={() => setActiveFlyout(null)}
                    className="absolute left-14 top-0 w-64 bg-[#262626] border border-zinc-700 text-white rounded-2xl shadow-2xl p-3.5 z-50 space-y-2.5"
                  >
                    <div className="font-bold text-xs text-zinc-200 tracking-wide">Recents</div>
                    <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                      {threads.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveThreadId(t.id);
                            setActiveFlyout(null);
                          }}
                          className="w-full text-left flex items-center gap-2 px-2.5 py-2 hover:bg-zinc-800 rounded-xl text-xs text-zinc-200 group transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link
                href={portalLink}
                className="p-2.5 hover:bg-white/15 rounded-xl text-white/90 hover:text-white transition cursor-pointer"
                title="Back to Main Portal"
              >
                <Home className="w-5 h-5" />
              </Link>
            </div>

            {/* ── User Profile Footer (Collapsed Panel - Pinned to absolute bottom end) ── */}
            <div className="w-full p-3 border-t border-white/15 shrink-0 bg-black/10 flex items-center justify-center min-h-[57px]">
              {user && (
                <div
                  className="w-8 h-8 rounded-lg bg-white text-[#0F4C81] font-black text-xs flex items-center justify-center shrink-0 shadow-xs cursor-pointer hover:scale-105 transition border border-[#FF9933]/50"
                  title={`${user.name} (${ROLE_LABEL[user.role] ?? user.role})`}
                >
                  {userInitials}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-white/10 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <Link
                  href={portalLink}
                  className="flex items-center gap-2 text-white/80 hover:text-white text-xs font-semibold group transition"
                  title="Return to Main Portal"
                >
                  <div className="p-1 rounded-md bg-white/10 group-hover:bg-white/20 transition">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </div>
                  <span>Back to Portal</span>
                </Link>

                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 text-white/70 hover:text-white transition rounded-lg hover:bg-white/10 cursor-pointer"
                  title="Collapse History Sidebar"
                >
                  <SidebarIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <BhumiBotAvatarInverted className="w-8 h-8 rounded-lg shadow-sm" />
                <div>
                  <div className="font-extrabold text-sm text-white tracking-wide leading-tight">BhumiBot AI</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex h-1.5 w-3.5 rounded-full overflow-hidden shrink-0 border border-white/30">
                      <div className="w-1/3 bg-[#FF9933]" />
                      <div className="w-1/3 bg-white" />
                      <div className="w-1/3 bg-[#138808]" />
                    </div>
                    <span className="text-[10px] text-white/70 font-medium leading-tight">Indian Land Law AI</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white text-[#0F4C81] hover:bg-slate-100 rounded-xl font-bold text-xs transition shadow-md border-t-2 border-t-[#FF9933] cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FF9933]" />
                <span>New Legal Analysis</span>
              </button>
            </div>

            <div className="p-3 pb-1 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-white/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search history..."
                  className="w-full bg-white/10 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none focus:border-white/40 transition"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
              {filteredPinned.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 text-[10px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1">
                    <Pin className="w-3 h-3 text-amber-300" />
                    <span>Pinned</span>
                  </div>
                  {filteredPinned.map((thread) => (
                    <ThreadListItem
                      key={thread.id}
                      thread={thread}
                      activeThreadId={activeThreadId}
                      editingThreadId={editingThreadId}
                      editingTitle={editingTitle}
                      setActiveThreadId={setActiveThreadId}
                      setEditingTitle={setEditingTitle}
                      handleSaveRename={handleSaveRename}
                      handleStartRename={handleStartRename}
                      handleTogglePin={handleTogglePin}
                      handleDeleteThread={handleDeleteThread}
                    />
                  ))}
                </div>
              )}

              <div className="space-y-1">
                {filteredPinned.length > 0 && (
                  <div className="px-2 text-[10px] uppercase font-bold tracking-wider text-white/50 pt-1">
                    <span>Recents</span>
                  </div>
                )}
                {filteredUnpinned.map((thread) => (
                  <ThreadListItem
                    key={thread.id}
                    thread={thread}
                    activeThreadId={activeThreadId}
                    editingThreadId={editingThreadId}
                    editingTitle={editingTitle}
                    setActiveThreadId={setActiveThreadId}
                    setEditingTitle={setEditingTitle}
                    handleSaveRename={handleSaveRename}
                    handleStartRename={handleStartRename}
                    handleTogglePin={handleTogglePin}
                    handleDeleteThread={handleDeleteThread}
                  />
                ))}
              </div>
            </div>

            {/* ── User Profile Footer (Left Panel) ── */}
            <div className="p-3 border-t border-white/15 shrink-0 bg-black/10">
              {user ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-white text-[#0F4C81] font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-xs font-extrabold truncate leading-tight">{user.name}</div>
                    <div className="text-white/70 text-[10px] font-medium leading-tight mt-0.5">{ROLE_LABEL[user.role] ?? user.role}</div>
                    {user.jurisdictionCode && (
                      <div className="text-amber-300 text-[9px] font-mono mt-0.5 truncate">{user.jurisdictionCode}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-white/60 flex items-center justify-between">
                  <span>BhumiChain Legal AI</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 2. Fresh Workspace ── */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#F8FAFC] relative">
        <div className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center px-5 justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <BhumiBotAvatar className="w-7 h-7 rounded-lg shadow-xs" />
              <div>
                <span className="font-bold text-xs text-slate-900 tracking-wide block leading-tight">
                  {activeThread?.title || 'BhumiBot Legal AI'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block leading-tight">Evidence-Based Indian Land Law Assistant</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={portalLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs"
            >
              <Home className="w-3.5 h-3.5 text-[#0F4C81]" />
              <span className="hidden sm:inline">Main Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Message Workspace */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6 custom-scrollbar">
          {messages.length === 0 ? (
            /* ── Hero Glass Welcome Screen ── */
            <div className="flex flex-col items-center justify-center min-h-[85%] w-full max-w-4xl mx-auto text-center space-y-6 px-2">
              <div className="w-14 h-14 rounded-2xl bg-[#0F4C81] flex items-center justify-center shadow-lg p-1">
                <BhumiBotAvatarInverted className="w-10 h-10 rounded-xl" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                  BhumiBot AI Legal Assistant
                </h1>
                <p className="text-xs md:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed font-medium">
                  Ask substantive questions on Indian land revenue, succession, registration vs. mutation, or attach property document text for legally defensible analysis.
                </p>
              </div>

              {/* ── Hero Input Box ── */}
              <div className="w-full max-w-3xl">
                {attachment && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 shadow-xs rounded-xl text-xs text-slate-900 mb-2 w-fit">
                    <FileText className="w-4 h-4 text-[#0F4C81]" />
                    <span className="font-bold truncate max-w-[240px]">{attachment.name}</span>
                    <span className="text-[10px] text-slate-500">({attachment.size})</span>
                    <button
                      onClick={() => setAttachment(null)}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="relative flex items-end bg-white border border-slate-200/90 focus-within:border-[#0F4C81] focus-within:ring-2 focus-within:ring-[#0F4C81]/10 rounded-2xl p-2.5 shadow-lg transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-500 hover:text-[#0F4C81] hover:bg-slate-100 rounded-xl transition shrink-0 mb-0.5 cursor-pointer"
                    title="Attach Property Document (PDF, Image, DOCX)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <textarea
                    ref={heroTextareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask any property legal question or paste document text..."
                    className="flex-1 bg-transparent px-3 py-2 text-xs md:text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none max-h-44 custom-scrollbar leading-relaxed font-medium"
                    disabled={isTyping}
                  />

                  <button
                    type="submit"
                    disabled={(!input.trim() && !attachment) || isTyping}
                    className="bg-[#0F4C81] hover:bg-[#0B3A64] disabled:opacity-30 text-white rounded-xl p-2.5 transition shrink-0 shadow-sm cursor-pointer mb-0.5"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* ── Dynamic Legal Recommendation Cards with Batch Rotation ── */}
              <div className="w-full max-w-3xl space-y-3 pt-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#0F4C81]" />
                    <span>Suggested Legal Analysis</span>
                  </span>

                  <button
                    type="button"
                    onClick={shuffleRecommendations}
                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-[#0F4C81] hover:bg-blue-50 bg-white border border-blue-200/90 rounded-xl transition cursor-pointer shadow-2xs"
                    title="Load 4 completely new legal suggestions"
                  >
                    <RotateCw className="w-3 h-3 text-[#0F4C81]" />
                    <span>New Suggestions</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left">
                  {currentRecommendations.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(card.question)}
                        className="p-3.5 bg-white border border-slate-200/90 hover:border-[#0F4C81]/40 hover:bg-slate-50/50 rounded-2xl transition-all duration-200 group text-left space-y-2 shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between min-h-[92px]"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-[#0F4C81] border border-blue-100">
                            {card.category}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F4C81] transition" />
                        </div>

                        <div className="flex items-start gap-2 font-bold text-xs text-slate-900 group-hover:text-[#0F4C81] transition leading-snug">
                          <Icon className="w-4 h-4 text-[#0F4C81] shrink-0 mt-0.5" />
                          <span>{card.question}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ── Active Stream ── */
            <div className="w-full max-w-4xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 mt-1">
                      <BhumiBotAvatar className="w-8 h-8 rounded-xl shadow-xs" />
                    </div>
                  )}

                  <div className={`max-w-[88%] md:max-w-[82%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'user' && msg.attachment && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs ml-auto w-fit shadow-xs">
                        <FileText className="w-3.5 h-3.5 text-slate-300" />
                        <span className="font-semibold truncate max-w-[200px]">{msg.attachment.name}</span>
                        <span className="text-[10px] text-slate-300">({msg.attachment.size})</span>
                      </div>
                    )}

                    <div
                      className={`rounded-2xl p-4 md:p-5 text-sm md:text-base leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#0F4C81] text-white shadow-md selection:bg-white selection:text-[#0F4C81]'
                          : 'bg-white border border-slate-200/90 text-slate-900 shadow-xs selection:bg-[#0F4C81] selection:text-white'
                      }`}
                    >
                      <FormattedResponse text={msg.text} isUser={msg.role === 'user'} />

                      {msg.role === 'assistant' && (
                        <div className="mt-3 pt-2 flex items-center justify-start gap-1 border-t border-slate-100">
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-[#0F4C81] hover:bg-slate-100 rounded-lg text-xs font-medium transition cursor-pointer"
                            title={copiedId === msg.id ? 'Copied!' : 'Copy response'}
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#0F4C81]" />
                                <span className="text-[#0F4C81] font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleSpeak(msg.id, msg.text)}
                            className="flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-[#0F4C81] hover:bg-slate-100 rounded-lg text-xs font-medium transition cursor-pointer"
                            title={speakingId === msg.id ? 'Stop reading' : 'Listen to response'}
                          >
                            {speakingId === msg.id ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-[#0F4C81] animate-pulse" />
                                <span className="text-[#0F4C81] font-bold">Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Listen</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div
                      className="w-8 h-8 rounded-xl bg-[#0F4C81] text-white border border-[#0F4C81]/30 flex items-center justify-center shrink-0 mt-1 font-black text-xs shadow-sm"
                      title={user?.name || 'User'}
                    >
                      {userInitials}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 justify-start items-center">
                  <BhumiBotAvatar className="w-8 h-8 rounded-xl shadow-xs shrink-0" />
                  <div className="bg-white border border-slate-200/90 px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-2xs">
                    {((messages.length > 0 && messages[messages.length - 1].role === 'user' && !!messages[messages.length - 1].attachment) || !!attachment) ? (
                      <>
                        <FileText className="w-3.5 h-3.5 text-[#0F4C81] animate-pulse shrink-0" />
                        <span className="text-xs font-semibold text-slate-600">Analyzing document</span>
                      </>
                    ) : null}
                    <div className="flex items-center gap-1.5 py-0.5">
                      <div className="w-2 h-2 rounded-full bg-[#0F4C81] animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 rounded-full bg-[#0F4C81] animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 rounded-full bg-[#0F4C81] animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        {messages.length > 0 && (
          <div className="p-4 bg-transparent shrink-0">
            <div className="w-full max-w-4xl mx-auto space-y-2">
              {attachment && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 shadow-xs rounded-xl text-xs md:text-sm text-slate-900 w-fit">
                  <FileText className="w-4 h-4 text-[#0F4C81]" />
                  <span className="font-bold truncate max-w-[240px]">{attachment.name}</span>
                  <span className="text-xs text-slate-500">({attachment.size})</span>
                  <button
                    onClick={() => setAttachment(null)}
                    className="p-0.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-end bg-white border border-slate-200/90 focus-within:border-[#0F4C81] focus-within:ring-2 focus-within:ring-[#0F4C81]/10 rounded-2xl p-2.5 shadow-lg transition-all"
              >
                <input
                  ref={messages.length > 0 ? fileInputRef : undefined}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-slate-500 hover:text-[#0F4C81] hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0 mb-0.5"
                  title="Attach Property Document (PDF, Image, DOCX)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <textarea
                  ref={bottomTextareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask any legal question or analyze attached document..."
                  className="flex-1 bg-transparent px-3.5 py-2 text-sm md:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-medium resize-none max-h-44 custom-scrollbar leading-relaxed"
                  disabled={isTyping}
                />

                <button
                  type="submit"
                  disabled={(!input.trim() && !attachment) || isTyping}
                  className="bg-[#0F4C81] hover:bg-[#0B3A64] disabled:opacity-30 text-white rounded-xl p-2.5 transition shrink-0 shadow-sm cursor-pointer mb-0.5"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Thread List Item Component ──────────────────────────────────────────────

function ThreadListItem({
  thread,
  activeThreadId,
  editingThreadId,
  editingTitle,
  setActiveThreadId,
  setEditingTitle,
  handleSaveRename,
  handleStartRename,
  handleTogglePin,
  handleDeleteThread,
}: {
  thread: ChatThread;
  activeThreadId: string | null;
  editingThreadId: string | null;
  editingTitle: string;
  setActiveThreadId: (id: string) => void;
  setEditingTitle: (t: string) => void;
  handleSaveRename: (id: string) => void;
  handleStartRename: (t: ChatThread, e: React.MouseEvent) => void;
  handleTogglePin: (id: string, e: React.MouseEvent) => void;
  handleDeleteThread: (id: string, e: React.MouseEvent) => void;
}) {
  const isActive = thread.id === activeThreadId;
  const isEditing = thread.id === editingThreadId;

  return (
    <div
      onClick={() => setActiveThreadId(thread.id)}
      className={clsx(
        'group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all',
        isActive
          ? 'bg-white/20 text-white font-bold border-l-3 border-l-[#FF9933] border-t border-r border-b border-white/20 shadow-xs backdrop-blur-xs'
          : 'text-white/75 hover:bg-white/10 hover:text-white'
      )}
    >
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => handleSaveRename(thread.id)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(thread.id)}
            autoFocus
            className="bg-black text-white px-1.5 py-0.5 rounded border border-white/40 text-xs w-full focus:outline-none"
          />
        ) : (
          <span className="truncate leading-snug font-medium">{thread.title}</span>
        )}
      </div>

      {!isEditing && (
        <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
          <button
            onClick={(e) => handleTogglePin(thread.id, e)}
            className={clsx(
              'p-1 transition',
              thread.isPinned ? 'text-amber-300 hover:text-white' : 'text-white/60 hover:text-white'
            )}
            title={thread.isPinned ? 'Unpin' : 'Pin to top'}
          >
            {thread.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
          </button>
          <button
            onClick={(e) => handleStartRename(thread, e)}
            className="p-1 hover:text-white text-white/60 transition"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => handleDeleteThread(thread.id, e)}
            className="p-1 hover:text-red-300 text-white/60 transition"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Formatted Response Renderer ─────────────────────────────────────────────

function FormattedResponse({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    return <div className="whitespace-pre-wrap leading-relaxed text-base md:text-lg font-medium">{text}</div>;
  }

  const sourcesIndex = text.search(/##?\s*Suggested References|Suggested References|##?\s*Sources|##?\s*References|##?\s*Verified Statutory/i);
  let bodyText = text;
  let sourcesText = '';

  if (sourcesIndex !== -1) {
    bodyText = text.substring(0, sourcesIndex).trim();
    sourcesText = text.substring(sourcesIndex).trim();
  }

  const paragraphs = bodyText.split('\n\n');

  return (
    <div className="space-y-3.5 text-base md:text-lg text-slate-900 leading-relaxed font-normal">
      {paragraphs.map((p, pIdx) => {
        const lines = p.split('\n');

        if (lines[0].startsWith('### ') || lines[0].startsWith('## ')) {
          const headerText = lines[0].replace(/^#+\s*/, '');
          return (
            <div key={pIdx} className="pt-1 space-y-1.5">
              <div className="font-black text-base md:text-lg text-[#0F4C81] pb-1 border-b border-slate-200/80 tracking-wide uppercase flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0F4C81]" />
                {headerText}
              </div>
              {lines.slice(1).map((l, lIdx) => (
                <div key={lIdx} className="mt-1">
                  <FormatLine line={l} />
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={pIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                const bulletText = line.trim().substring(1).trim();
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 my-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#0F4C81] shrink-0 mt-2" />
                    <div className="flex-1">
                      <FormatLine line={bulletText} />
                    </div>
                  </div>
                );
              }

              return (
                <div key={lIdx}>
                  <FormatLine line={line} />
                </div>
              );
            })}
          </div>
        );
      })}

      {sourcesText && <SourcesReferenceCard sourcesText={sourcesText} />}
    </div>
  );
}

function FormatLine({ line }: { line: string }) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);

  return (
    <span>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          if (/Act|Section|Rule|Article|Judgment|Case|SCC|DLPI|Court/i.test(content)) {
            return (
              <span
                key={idx}
                className="font-mono text-xs md:text-sm font-bold text-[#0F4C81] bg-[#0F4C81]/10 border border-[#0F4C81]/25 px-2 py-0.5 rounded-md inline-block my-0.5"
              >
                {content}
              </span>
            );
          }
          return (
            <strong key={idx} className="font-extrabold text-slate-900">
              {content}
            </strong>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}

function SourcesReferenceCard({ sourcesText }: { sourcesText: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const lines = sourcesText.split('\n').filter((l) => l.trim().length > 0);
  const header = lines[0].replace(/^#+\s*/, '').trim();

  const rawItemsText = sourcesText.substring(sourcesText.indexOf(lines[0]) + lines[0].length);
  const itemBlocks = rawItemsText.split(/\n(?=\d+\.\s)/g).map((b) => b.trim()).filter(Boolean);
  const count = itemBlocks.length;

  return (
    <div className="mt-5 border border-slate-200/90 rounded-2xl bg-white shadow-2xs overflow-hidden transition-all duration-200">
      {/* Accordion Dropdown Header Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-blue-50/60 transition cursor-pointer text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-[#0F4C81]/10 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-[#0F4C81]" />
          </div>
          <span className="font-extrabold text-xs md:text-sm text-[#0F4C81] uppercase tracking-wider">
            {header || 'Suggested References'}
          </span>
          {count > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-[#0F4C81] text-white rounded-full">
              {count} {count === 1 ? 'Source' : 'Sources'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
          <span>{isOpen ? 'Hide References' : 'View References'}</span>
          <ChevronDown className={clsx('w-4 h-4 text-[#0F4C81] transition-transform duration-200', isOpen && 'rotate-180')} />
        </div>
      </button>

      {/* Accordion Dropdown Content Body */}
      {isOpen && (
        <div className="p-4 bg-slate-50/50 border-t border-slate-200/80 space-y-3">
          {itemBlocks.length === 0 ? (
            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed px-1">
              {lines.slice(1).join('\n')}
            </div>
          ) : (
            itemBlocks.map((block, idx) => {
              const itemLines = block.split('\n').map((l) => l.trim());
              const titleLine = itemLines[0]?.replace(/^\d+\.\s*/, '') || '';
              
              let description = '';
              let link = '';

              itemLines.slice(1).forEach((line) => {
                if (/^\-?\s*Description:/i.test(line)) {
                  description = line.replace(/^\-?\s*Description:\s*/i, '');
                } else if (/^\-?\s*Link:/i.test(line)) {
                  link = line.replace(/^\-?\s*Link:\s*/i, '');
                }
              });

              const urlMatch = link.match(/(https?:\/\/[^\s]+)/g) || block.match(/(https?:\/\/[^\s]+)/g);
              const directUrl = urlMatch ? urlMatch[0] : null;

              return (
                <div
                  key={idx}
                  className="p-3.5 bg-white border border-slate-200/90 rounded-xl text-xs md:text-sm text-slate-800 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 font-bold text-slate-900 leading-snug">
                      <span className="font-mono text-[#0F4C81] shrink-0">{idx + 1}.</span>
                      <span>{titleLine}</span>
                    </div>
                    {directUrl ? (
                      <a
                        href={directUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#0F4C81] text-white hover:bg-[#0B3A64] rounded-lg font-semibold text-xs shrink-0 transition shadow-2xs cursor-pointer"
                      >
                        <span>View Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 italic">No Public Link</span>
                    )}
                  </div>

                  {description && (
                    <p className="text-xs text-slate-600 leading-relaxed pl-5">
                      <span className="font-semibold text-slate-700">Description: </span>
                      {description}
                    </p>
                  )}

                  {link && !directUrl && (
                    <p className="text-[11px] font-mono text-slate-500 pl-5 italic">
                      {link}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
