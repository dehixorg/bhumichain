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
} from 'lucide-react';
import axios from 'axios';
import { getUser, isOfficer } from '@/lib/auth';

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

// ─── Fresh System Prompt V5 Smart Legal Guidance Cards ─────────────────────────

const SYSTEM_V5_SMART_CARDS = [
  {
    title: 'Succession & Coparcenary Rights',
    desc: 'Hindu Succession Act 2005 coparcenary rights, daughter inheritance & Supreme Court precedents',
    query: 'What are the coparcenary inheritance rights of a daughter under Hindu Succession Act 2005?',
    category: 'Inheritance Law',
    icon: Scale,
  },
  {
    title: 'Registration vs. Revenue Mutation',
    desc: 'Legal distinction between registered sale deed execution and government revenue mutation entries',
    query: 'Explain the legal difference between registering a sale deed and applying for revenue land mutation.',
    category: 'Property Transfer',
    icon: Landmark,
  },
  {
    title: 'Encumbrance & Mortgage Search',
    desc: 'Section 57 Registration Act 1908, bank charges, court stay injunctions & EC verification',
    query: 'How can I verify if a property has registered bank mortgages, court injunctions, or encumbrances?',
    icon: ShieldCheck,
  },
  {
    title: 'Document Evidence Legal Risk Analysis',
    desc: 'Analyze uploaded 7/12 Satbara, Khatauni, or Sale Deed text for title defects & fraud indicators',
    query: 'What legal details and potential defect indicators should I check when analyzing a land record document?',
    icon: FileCheck2,
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

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Clear un-sent attachment and input whenever switching or creating chat threads
  useEffect(() => {
    setAttachment(null);
    setInput('');
  }, [activeThreadId]);

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
      
      {/* ── 1. Royal Navy Sidebar (#0F4C81) ── */}
      <div
        className={clsx(
          'bg-[#0F4C81] text-white flex flex-col border-r border-[#0F4C81]/30 transition-all duration-300 shrink-0 z-20 shadow-xl overflow-visible relative',
          sidebarOpen ? 'w-64 md:w-72' : 'w-14'
        )}
      >
        {!sidebarOpen ? (
          <div className="flex flex-col items-center py-3.5 space-y-3.5 h-full relative">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-white/15 rounded-xl text-white transition cursor-pointer"
              title="Expand Sidebar"
            >
              <BhumiBotAvatarInverted className="w-6 h-6 rounded-md shadow-sm" />
            </button>

            <button
              onClick={handleNewChat}
              className="p-2.5 hover:bg-white/15 rounded-xl text-white/90 hover:text-white transition cursor-pointer"
              title="New Legal Analysis"
            >
              <Plus className="w-5 h-5" />
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
                          className="w-full text-left flex items-center gap-2 px-2.5 py-2 hover:bg-zinc-800 rounded-xl text-xs text-zinc-200 group transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white shrink-0" />
                          <span className="truncate">{t.title}</span>
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
              className="mt-auto p-2.5 mb-2 hover:bg-white/15 rounded-xl text-white/90 hover:text-white transition cursor-pointer"
              title="Back to Main Portal"
            >
              <Home className="w-5 h-5" />
            </Link>
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
                  <div className="text-[10px] text-white/60 font-medium leading-tight">Legal Intelligence Workspace</div>
                </div>
              </div>

              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white text-[#0F4C81] hover:bg-slate-100 rounded-xl font-bold text-xs transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
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

            <div className="p-3 border-t border-white/10 text-[10px] text-white/60 flex items-center justify-between shrink-0">
              <span>BhumiChain Legal AI</span>
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
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </div>

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
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 ? (
            /* ── Hero Glass Welcome Screen ── */
            <div className="flex flex-col items-center justify-center min-h-[85%] max-w-2xl mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0F4C81] to-blue-600 flex items-center justify-center shadow-xl p-1">
                <BhumiBotAvatarInverted className="w-13 h-13 rounded-xl" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  BhumiBot AI Legal Assistant
                </h1>
                <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed font-medium">
                  Ask substantive questions on Indian land revenue, succession, registration vs. mutation, or attach property document text for legally defensible analysis.
                </p>
              </div>

              {/* ── Hero Input Box ── */}
              <div className="w-full max-w-2xl">
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
                  className="relative flex items-center bg-white border border-slate-200/90 focus-within:border-[#0F4C81] focus-within:ring-2 focus-within:ring-[#0F4C81]/10 rounded-2xl p-2.5 shadow-xl transition-all"
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
                    className="p-2 text-slate-500 hover:text-[#0F4C81] hover:bg-slate-100 rounded-xl transition"
                    title="Attach Document Text"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask any property legal question or paste document text..."
                    className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                    disabled={isTyping || isExtractingDoc}
                  />

                  <button
                    type="submit"
                    disabled={(!input.trim() && !attachment) || isTyping || isExtractingDoc}
                    className="bg-[#0F4C81] hover:bg-[#0B3A64] disabled:opacity-30 text-white rounded-xl p-2.5 transition shrink-0 shadow-sm cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* ── Redesigned System Prompt V5 Guidance Cards ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full text-left pt-1">
                {SYSTEM_V5_SMART_CARDS.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(card.query)}
                      className="p-4 bg-white border border-slate-200/90 hover:border-[#0F4C81]/40 hover:bg-slate-50/50 rounded-2xl transition-all duration-200 group text-left space-y-2 shadow-xs hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-[#0F4C81] border border-blue-100">
                          {card.category}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F4C81] transition" />
                      </div>
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-900 group-hover:text-[#0F4C81] transition">
                        <Icon className="w-4 h-4 text-[#0F4C81] shrink-0" />
                        <span>{card.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {card.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Active Stream ── */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 mt-1">
                      <BhumiBotAvatar className="w-7 h-7 rounded-lg shadow-xs" />
                    </div>
                  )}

                  <div className={`max-w-[88%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
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
                          ? 'bg-[#0F4C81] text-white shadow-md'
                          : 'bg-white/90 backdrop-blur-md border border-slate-200/80 text-slate-900 shadow-xs'
                      }`}
                    >
                      <FormattedResponse text={msg.text} isUser={msg.role === 'user'} />

                      {msg.role === 'assistant' && (
                        <div className="mt-2.5 pt-1 flex items-center justify-start gap-1">
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="p-1.5 text-slate-400 hover:text-[#0F4C81] hover:bg-slate-100/80 rounded-lg transition cursor-pointer"
                            title={copiedId === msg.id ? 'Copied!' : 'Copy response'}
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-4 h-4 text-[#0F4C81]" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleSpeak(msg.id, msg.text)}
                            className="p-1.5 text-slate-400 hover:text-[#0F4C81] hover:bg-slate-100/80 rounded-lg transition cursor-pointer"
                            title={speakingId === msg.id ? 'Stop reading' : 'Listen to response'}
                          >
                            {speakingId === msg.id ? (
                              <VolumeX className="w-4 h-4 text-[#0F4C81] animate-pulse" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-900 flex items-center justify-center shrink-0 mt-1 font-bold">
                      <User className="w-4.5 h-4.5" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 justify-start items-center">
                  <BhumiBotAvatar className="w-8 h-8 rounded-lg shadow-xs animate-pulse" />
                  <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 px-4 py-3 rounded-2xl flex items-center gap-1.5 shadow-2xs">
                    <div className="w-2 h-2 rounded-full bg-[#0F4C81] animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 rounded-full bg-[#0F4C81] animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 rounded-full bg-[#0F4C81] animate-bounce" />
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
            <div className="max-w-3xl mx-auto space-y-2">
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
                className="relative flex items-center bg-white/90 backdrop-blur-xl border border-slate-200/90 focus-within:border-[#0F4C81] focus-within:ring-2 focus-within:ring-[#0F4C81]/10 rounded-2xl p-2.5 shadow-lg transition-all"
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
                  className="p-2.5 text-slate-500 hover:text-[#0F4C81] hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Attach Document Evidence"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask any legal question or analyze attached document..."
                  className="flex-1 bg-transparent px-3.5 py-2 text-sm md:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                  disabled={isTyping}
                />

                <button
                  type="submit"
                  disabled={(!input.trim() && !attachment) || isTyping}
                  className="bg-[#0F4C81] hover:bg-[#0B3A64] disabled:opacity-30 text-white rounded-xl p-3 transition shrink-0 shadow-sm cursor-pointer"
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
          ? 'bg-white/20 text-white font-bold border border-white/25 shadow-sm backdrop-blur-md'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <BhumiBotAvatarInverted className="w-4 h-4 rounded shrink-0 opacity-90" />
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
          <span className="truncate leading-snug">{thread.title}</span>
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

  const sourcesIndex = text.search(/##?\s*Sources|##?\s*References|##?\s*Verified Statutory/i);
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
  const lines = sourcesText.split('\n').filter((l) => l.trim().length > 0);
  const header = lines[0].replace(/^#+\s*/, '');
  const citationItems = lines.slice(1);

  return (
    <div className="mt-5 pt-3.5 border-t-2 border-[#0F4C81] space-y-2.5 bg-[#0F4C81]/5 p-4 rounded-2xl border border-[#0F4C81]/15 backdrop-blur-xs">
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#0F4C81]">
        <ShieldCheck className="w-4 h-4 text-[#0F4C81]" />
        <span>{header}</span>
      </div>

      <div className="space-y-2">
        {citationItems.map((item, idx) => {
          const urlMatch = item.match(/(https?:\/\/[^\s]+)/g);
          const url = urlMatch ? urlMatch[0] : null;
          const cleanItem = item.replace(/(https?:\/\/[^\s]+)/g, '').trim();

          return (
            <div
              key={idx}
              className="flex items-start justify-between gap-2.5 p-3 bg-white border border-slate-200/80 rounded-xl text-xs md:text-sm text-slate-800 shadow-2xs"
            >
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-[#0F4C81] shrink-0">[{idx + 1}]</span>
                <span>{cleanItem}</span>
              </div>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#0F4C81] text-white hover:bg-[#0B3A64] rounded-lg font-semibold text-xs shrink-0 transition shadow-2xs"
                >
                  <span>Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
