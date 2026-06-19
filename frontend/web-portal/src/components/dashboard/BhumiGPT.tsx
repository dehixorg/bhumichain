'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Send, Cpu, ExternalLink, BookOpen, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  language?: string;
  confidence?: number;
  sources?: string[];
}

export interface BhumiGPTProps {
  className?: string;
}

// ─── Pre-scripted Q&A (offline / demo fallback) ───────────────────────────────

const PRESET_QA: Array<{ q: string; lang: string; a: string; confidence: number; sources: string[] }> = [
  {
    q: 'माझ्या जमिनीवर मुलीचा अधिकार आहे का?',
    lang: 'mr',
    a:
      'होय. **हिंदू वारसा (सुधारणा) अधिनियम 2005** च्या कलम 6(3) नुसार, मुलगी जन्मापासूनच मिताक्षरा ' +
      'कोपार्सनरी मालमत्तेत सहवारस आहे — मुलाइतकाच तिचा अधिकार आहे.\n\n' +
      'सर्वोच्च न्यायालयाने **Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1** मध्ये हे पुष्टी केले की ' +
      'हे तरतूद 9 सप्टेंबर 2005 पूर्वी वडिलांचा मृत्यू झाला असला तरी लागू होते.\n\n' +
      'BhumiChain वरील **Uttaradhikar chaincode** हे chaincode स्तरावर लागू करते — कोणताही ' +
      'महसूल अधिकारी मुलीचा वाटा कमी करू शकत नाही.',
    confidence: 0.98,
    sources: [
      'Hindu Succession (Amendment) Act 2005, Section 6(3)',
      'Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1',
      'Mitakshara coparcenary — equal birth rights',
    ],
  },
  {
    q: 'आदिवासी जमीन गैर-आदिवासींना विकता येते का?',
    lang: 'mr',
    a:
      '**नाही.** पाचव्या अनुसूचीत (Schedule V) समाविष्ट क्षेत्रातील आदिवासी जमीन गैर-आदिवासींना ' +
      'विकता येत नाही.\n\n' +
      'सर्वोच्च न्यायालयाने **Samatha v. State of AP (1997) 8 SCC 191** मध्ये स्पष्ट सांगितले की ' +
      'असे हस्तांतरण घटनाबाह्य आणि **void ab initio** (शून्य आहे पहिल्यापासूनच) आहे.\n\n' +
      'BhumiChain चे **TribalGuard chaincode** हे 200ms पेक्षा कमी वेळात स्वयंचलितपणे नाकारते ' +
      'आणि NALSA, ST आयुक्त, आणि जिल्हाधिकारी यांना तत्काळ सूचित करते.',
    confidence: 0.99,
    sources: [
      'Constitution of India, Fifth Schedule, Article 244(1)',
      'Samatha v. State of Andhra Pradesh (1997) 8 SCC 191',
      'Maharashtra Land Revenue Code, Section 36A',
      'Forest Rights Act 2006, Section 4(5)',
    ],
  },
  {
    q: 'Encumbrance Certificate कसे मिळते?',
    lang: 'mr',
    a:
      'BhumiChain वर **30 सेकंदांत** Encumbrance Certificate (EC) मिळते.\n\n' +
      '1. GIS Map वर जाऊन तुमचा DLPI नंबर शोधा\n' +
      '2. "Generate EC" बटण दाबा\n' +
      '3. QR-verified EC तत्काळ तयार होते\n\n' +
      'या EC मध्ये सर्व **गहाण (mortgage), न्यायालयीन आदेश (court injunction), आणि IT attachment** ' +
      'नोंदवलेले असतात.\n\n' +
      'पारंपारिक पद्धतीने हेच काम 7-15 दिवस लागत होते आणि Sub-Registrar Office ला प्रत्यक्ष ' +
      'भेट द्यावी लागत होती.',
    confidence: 0.95,
    sources: [
      'Registration Act 1908, Section 57',
      'Maharashtra Land Revenue Code',
      'BhumiChain Encumbrance chaincode — GenerateEC()',
    ],
  },
  {
    q: '7/12 उतारा (Satbara) म्हणजे काय?',
    lang: 'mr',
    a:
      '**सातबारा उतारा (7/12)** हा महाराष्ट्रातील सर्वात महत्त्वाचा जमीन दस्तऐवज आहे.\n\n' +
      '**Part I** (Register 7): सर्वे नंबर, मालक, क्षेत्र, जमीन प्रकार\n' +
      '**Part II** (Register 12): बोजे, गहाण, विविध नोंदी\n\n' +
      'BhumiChain वर **DLPI (Digital Land Parcel Identity)** हे Satbara चे डिजिटल, ' +
      'छेडछाड-प्रतिरोधी (tamper-proof) रूप आहे — **Mahabhulekh e-Satbara** registry शी ' +
      'cross-validated केले जाते.\n\n' +
      'RecordScan AI हे स्कॅन केलेले Satbara 93% पेक्षा जास्त अचूकतेने वाचते आणि थेट ' +
      'blockchain वर नोंदवते.',
    confidence: 0.97,
    sources: [
      'Maharashtra Land Revenue Code, Section 149',
      'Mahabhulekh e-Satbara Registry',
      'BhumiChain RecordScan AI — Azure Document Intelligence + LayoutLM NER',
    ],
  },
  {
    q: 'Can my daughter inherit my property equally with my son?',
    lang: 'en',
    a:
      '**Yes, absolutely.** The Hindu Succession (Amendment) Act 2005, Section 6(3), grants daughters equal ' +
      'coparcenary rights in Mitakshara joint family property from birth — identical to sons.\n\n' +
      'The Supreme Court confirmed in **Vineeta Sharma v. Rakesh Sharma (2020)** that this applies even if the ' +
      'father died before 9 September 2005.\n\n' +
      'On BhumiChain, the Uttaradhikar chaincode **hard-enforces** equal shares — no revenue officer can ' +
      'allocate a smaller share to a daughter. If attempted, the transaction is rejected with the exact ' +
      'Section 6(3) citation.',
    confidence: 0.98,
    sources: [
      'Hindu Succession (Amendment) Act 2005, Section 6(3)',
      'Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1',
    ],
  },
];

// Find the best matching pre-scripted response for a query
function findPreset(query: string) {
  const q = query.trim().toLowerCase();
  return PRESET_QA.find((p) =>
    p.q.toLowerCase() === q ||
    p.q.toLowerCase().includes(q.slice(0, 20)) ||
    q.includes(p.q.toLowerCase().slice(0, 20)),
  ) || null;
}

const uid = () => Math.random().toString(36).slice(2);

// ─── Component ────────────────────────────────────────────────────────────────

export default function BhumiGPT({ className }: BhumiGPTProps) {
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState('');
  const [isTyping, setIsTyping]     = useState(false);
  const messagesEndRef              = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: uid(), role: 'user', text: text.trim(), timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Try API, fall back to local preset
    await delay(900 + Math.random() * 600);

    let botText = '';
    let confidence = 0.90;
    let sources: string[] = [];
    let language = 'mr';

    const preset = findPreset(text);

    if (preset) {
      botText    = preset.a;
      confidence = preset.confidence;
      sources    = preset.sources;
      language   = preset.lang;
    } else {
      try {
        const res = await api.post('/api/ai/bhumi-gpt/query', { query: text, language: 'auto' });
        botText    = res.data.response;
        confidence = res.data.confidence ?? 0.85;
        sources    = res.data.sources ?? [];
        language   = res.data.language ?? 'mr';
      } catch {
        // Generic offline fallback
        botText    = detectLanguage(text) === 'mr'
          ? `माफ करा, मी आत्ता तुमच्या प्रश्नाचे उत्तर देऊ शकत नाही. कृपया पुन्हा प्रयत्न करा किंवा खालील नमुना प्रश्न वापरा.`
          : `I'm sorry, I couldn't process your question right now. Please try one of the preset questions below.`;
        confidence = 0.0;
      }
    }

    setIsTyping(false);
    setMessages((prev) => [...prev, {
      id: uid(), role: 'assistant', text: botText,
      timestamp: new Date(), confidence, sources, language,
    }]);
  }, [isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handlePreset = (q: string) => {
    setInput(q);
    sendMessage(q);
  };

  return (
    <div className={clsx('flex flex-col h-full', className)}>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <WelcomeScreen onPreset={handlePreset} />
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Preset shortcuts (compact, only when no messages) */}
      {messages.length > 0 && messages.length < 3 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {PRESET_QA.slice(0, 3).map((p) => (
            <button
              key={p.q}
              onClick={() => handlePreset(p.q)}
              disabled={isTyping}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-full px-3 py-1.5 transition-colors truncate max-w-[180px]"
            >
              {p.q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="जमिनीबद्दल विचारा… (Marathi / English / Hindi)"
            className="input flex-1 text-sm"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="btn-primary px-3 py-2 flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
          <span>Marathi · Hindi · English supported</span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            Claude API + Land Law RAG
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function WelcomeScreen({ onPreset }: { onPreset: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-900 border border-brand-700 flex items-center justify-center mb-4">
        <span className="text-2xl font-bold text-brand-300">भू</span>
      </div>
      <div className="text-gray-200 font-semibold mb-1">BhumiGPT</div>
      <div className="text-gray-500 text-sm mb-6 max-w-xs">
        जमीन हक्क, वारसा, आणि नोंदणी विषयी मराठी, हिंदी, किंवा इंग्रजीत विचारा.
      </div>
      <div className="w-full space-y-2 max-w-sm">
        <div className="text-xs text-gray-500 mb-3 text-left">नमुना प्रश्न / Sample questions:</div>
        {PRESET_QA.map((p) => (
          <button
            key={p.q}
            onClick={() => onPreset(p.q)}
            className="w-full text-left text-xs bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-brand-700 text-gray-300 rounded-xl px-3 py-2.5 transition-colors flex items-center gap-2 group"
          >
            <ChevronRight className="w-3 h-3 text-brand-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            <span className="flex-1">{p.q}</span>
            <span className="text-gray-600 shrink-0 text-xs">{p.lang === 'mr' ? 'मराठी' : p.lang === 'hi' ? 'हिंदी' : 'English'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[85%] space-y-1.5', isUser ? 'items-end' : 'items-start')}>

        {/* Bubble */}
        <div className={clsx(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-brand-700 text-white rounded-br-sm'
            : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm',
        )}>
          <FormattedText text={msg.text} />
        </div>

        {/* Confidence + time */}
        <div className={clsx('flex items-center gap-2 px-1', isUser ? 'justify-end' : 'justify-start')}>
          <span className="text-xs text-gray-600">
            {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && msg.confidence !== undefined && msg.confidence > 0 && (
            <span className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              msg.confidence >= 0.95 ? 'bg-brand-950 text-brand-400' :
              msg.confidence >= 0.80 ? 'bg-amber-950 text-amber-400' :
                                       'bg-gray-800 text-gray-500',
            )}>
              {Math.round(msg.confidence * 100)}% confidence
            </span>
          )}
        </div>

        {/* Sources */}
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="px-1 space-y-1">
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <BookOpen className="w-3 h-3" />
              Sources
            </div>
            {msg.sources.map((s, i) => (
              <div key={i} className="flex items-start gap-1 text-xs text-gray-500">
                <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 text-brand-600" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// Minimal markdown-ish formatter: bold **text** and newlines
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <React.Fragment key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
                : <React.Fragment key={j}>{part}</React.Fragment>,
            )}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectLanguage(text: string): 'mr' | 'hi' | 'en' {
  // Simple heuristic: Devanagari script = Indian language
  if (/[ऀ-ॿ]/.test(text)) return 'mr';
  return 'en';
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
