import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Menu, 
  Plus, 
  FileText, 
  PenTool, 
  BarChart2, 
  Mic, 
  ArrowUp,
  MessageSquare,
  Trash2,
  Globe,
  Volume2,
  VolumeX,
  StopCircle,
  Copy,
  Check
} from 'lucide-react';

// --- Markdown Formatter Component ---
const FormattedText = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      const match = part.match(/```([a-z]*)\n([\s\S]*?)```/);
      const code = match ? match[2] : part.replace(/```/g, '');
      const lang = match ? match[1] : '';
      return (
        <div key={index} className="my-4 rounded-[20px] overflow-hidden bg-[#111] border border-white/10 shadow-2xl">
          {lang && <div className="bg-[#1a1a1a] px-4 py-2 text-[10px] text-gray-400 font-mono uppercase tracking-wider flex justify-between items-center">{lang}</div>}
          <pre className="p-4 overflow-x-auto text-[13px] font-mono text-gray-300 custom-scrollbar">
            <code>{code.trim()}</code>
          </pre>
        </div>
      );
    }

    const formattedText = part.split(/(\*\*.*?\*\*)/g).map((subPart, subIndex) => {
      if (subPart.startsWith('**') && subPart.endsWith('**')) {
        return <strong key={subIndex} className="text-white font-semibold">{subPart.slice(2, -2)}</strong>;
      }
      return subPart.split('\n').map((line, i, arr) => (
        <React.Fragment key={`${subIndex}-${i}`}>
          {line}
          {i !== arr.length - 1 && <br />}
        </React.Fragment>
      ));
    });

    return <span key={index}>{formattedText}</span>;
  });
};

const App = () => {
  // --- State Management ---
  const [view, setView] = useState('home'); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const recognitionRef = useRef(null);

  const apiKey = "AIzaSyAXjS_yo2ScKaSqlB5QYNa6yDairii0_RY"; 
  const AI_NAME = "Proxis";
  const SYSTEM_PROMPT = "You are Proxis, a Large Language model Created by RonzDavil. Be natural, friendly, helpful, and concise. Use markdown for formatting.";

  // --- Persistence ---
  useEffect(() => {
    const savedChats = localStorage.getItem('proxis_history_v3');
    if (savedChats) setChatHistory(JSON.parse(savedChats));
  }, []);

  useEffect(() => {
    localStorage.setItem('proxis_history_v3', JSON.stringify(chatHistory));
  }, [chatHistory]);

  // --- Voice Setup ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
           setInputValue(finalTranscript);
           handleSendMessage(finalTranscript);
           setIsListening(false);
        } else {
           setInputValue(interimTranscript);
        }
      };
      
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [messages]); // Rebind to access latest state

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInputValue('');
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    // Clean markdown before speaking
    const cleanText = text.replace(/```[\s\S]*?```/g, 'Code block omitted from speech.')
                          .replace(/\*\*/g, '')
                          .replace(/\*/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1; // Slightly faster for natural feel
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // --- API & Simulated Streaming Logic ---
  const callAPI = async (text) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      tools: [{ "google_search": {} }]
    };

    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return await response.json();
      } catch (error) {
        if (i === 4) throw error;
        await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
      }
    }
  };

  const streamTextToUI = (fullText, messageIndex, sources) => {
    let currentIndex = 0;
    const chunkSize = 4; // Characters per tick for ultra-fast smooth feel
    
    clearInterval(streamIntervalRef.current);
    
    streamIntervalRef.current = setInterval(() => {
      currentIndex += chunkSize;
      const currentText = fullText.slice(0, currentIndex);
      
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[messageIndex] = { 
          ...newMsgs[messageIndex], 
          content: currentText,
          sources: currentIndex >= fullText.length ? sources : [],
          isStreaming: currentIndex < fullText.length
        };
        return newMsgs;
      });

      // Auto-scroll while streaming
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }

      if (currentIndex >= fullText.length) {
        clearInterval(streamIntervalRef.current);
        speak(fullText);
      }
    }, 16); // ~60fps rendering
  };

  const handleSendMessage = async (textToProcess) => {
    const text = typeof textToProcess === 'string' ? textToProcess : inputValue;
    if (!text.trim()) return;

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px';
    }

    const userMsg = { role: 'user', content: text };
    const initialAiMsg = { role: 'assistant', content: '', isStreaming: true };
    
    const newMessages = [...messages, userMsg, initialAiMsg];
    setMessages(newMessages);
    setInputValue('');
    setView('chat');
    setIsThinking(true);
    
    const aiMessageIndex = newMessages.length - 1;

    try {
      const result = await callAPI(text);
      setIsThinking(false);
      
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "I encountered an error.";
      const sources = result.candidates?.[0]?.groundingMetadata?.groundingAttributions?.map(a => ({
        uri: a.web?.uri, title: a.web?.title
      })) || [];

      streamTextToUI(aiResponse, aiMessageIndex, sources);

      if (messages.length === 0) {
        setChatHistory(prev => [{ title: text.slice(0, 25) + '...', id: Date.now() }, ...prev]);
      }
    } catch (error) {
      setIsThinking(false);
      setMessages(prev => {
        const errMsgs = [...prev];
        errMsgs[aiMessageIndex] = { role: 'assistant', content: "Network error. Please try again.", isStreaming: false };
        return errMsgs;
      });
    }
  };

  // --- Auto Resize Textarea ---
  const handleInput = (e) => {
    setInputValue(e.target.value);
    e.target.style.height = '56px'; // Reset base height
    const scrollHeight = e.target.scrollHeight;
    e.target.style.height = Math.min(scrollHeight, 150) + 'px';
  };

  // --- UI Components ---
  const StarLogo = ({ size = 24, animated = false }) => (
    <div className={`relative flex items-center justify-center ${animated ? 'animate-pulse' : ''}`}>
      {animated && <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-30 rounded-full" />}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 drop-shadow-2xl">
        <path d="M12 1L14.81 8.62L23 9.24L16.5 13.97L18.18 22L12 17.27L5.82 22L7.5 13.97L1 9.24L9.19 8.62L12 1Z" 
          fill="url(#star-grad)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round" />
        <defs>
          <linearGradient id="star-grad" x1="1" y1="1" x2="23" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor="#818CF8" />
            <stop offset="0.5" stopColor="#A78BFA" />
            <stop offset="1" stopColor="#C084FC" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#030303] text-gray-100 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      {/* Sidebar Overlay */}
      <div className={`fixed inset-0 z-50 transition-all duration-500 ease-out ${sidebarOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setSidebarOpen(false)} />
        <div className={`absolute top-3 bottom-3 left-3 w-72 bg-[#0c0c0c] rounded-[32px] border border-white/5 flex flex-col p-6 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-[120%]'}`}>
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <StarLogo size={22} />
              <span className="font-bold text-lg tracking-tight">{AI_NAME}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex justify-between">
              <span>Recents</span>
              {chatHistory.length > 0 && <Trash2 size={14} className="cursor-pointer hover:text-red-400 transition-colors" onClick={() => setChatHistory([])}/>}
            </div>
            {chatHistory.map(chat => (
              <div key={chat.id} className="px-4 py-3 bg-white/5 rounded-2xl text-[13px] font-medium text-gray-300 truncate hover:bg-white/10 hover:text-white cursor-pointer transition-colors border border-transparent hover:border-white/5">
                {chat.title}
              </div>
            ))}
          </div>
          <button onClick={() => { setMessages([]); setView('home'); setSidebarOpen(false); }} className="mt-4 bg-white hover:bg-gray-200 text-black py-4 rounded-[24px] font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <Plus size={18} /> New Chat
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="px-5 pt-5 pb-2 flex items-center justify-between shrink-0 z-10">
        <button onClick={() => setSidebarOpen(true)} className="p-3 bg-[#0c0c0c] hover:bg-[#1a1a1a] rounded-[24px] border border-white/5 transition-colors">
          <Menu size={22} className="text-gray-300" />
        </button>
        <div className="bg-[#0c0c0c] px-4 py-2 rounded-full border border-white/5 flex items-center gap-2.5 shadow-lg">
          <StarLogo size={14} animated={isThinking || messages[messages.length-1]?.isStreaming} />
          <span className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">Proxis AI</span>
        </div>
        <div className="w-11" /> {/* Spacer */}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 pb-40 custom-scrollbar scroll-smooth" ref={scrollRef}>
        {view === 'home' ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-10 animate-in fade-in duration-1000">
            <div className="w-24 h-24 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-[40px] flex items-center justify-center shadow-2xl border border-white/10 relative group">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-[40px] blur-2xl group-hover:bg-indigo-500/30 transition-all" />
              <StarLogo size={48} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              What can I help with?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full px-4">
              {[
                { l: 'Summarize text', i: <FileText className="text-orange-400 w-5 h-5" /> },
                { l: 'Help me write', i: <PenTool className="text-pink-400 w-5 h-5" /> },
                { l: 'Analyze data', i: <BarChart2 className="text-blue-400 w-5 h-5" /> },
                { l: 'Search the web', i: <Globe className="text-emerald-400 w-5 h-5" /> }
              ].map((b, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSendMessage(b.l)} 
                  className="p-4 bg-[#0c0c0c] border border-white/5 rounded-[28px] flex items-center gap-4 hover:bg-[#1a1a1a] hover:border-white/10 transition-all group text-left"
                >
                  <div className="p-2.5 bg-white/5 rounded-[18px] group-hover:scale-110 transition-transform">{b.i}</div>
                  <span className="text-[14px] font-semibold text-gray-300">{b.l}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8 pt-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-4 sm:gap-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                
                {m.role === 'assistant' && (
                  <div className="shrink-0 mt-2">
                    <StarLogo size={24} animated={m.isStreaming || (i === messages.length - 1 && isThinking)} />
                  </div>
                )}
                
                <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                  {m.role === 'assistant' && isThinking && m.content === '' ? (
                    <div className="p-5 bg-transparent border-none flex gap-2 items-center">
                       <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                       <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                       <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                    </div>
                  ) : (
                    <div className={`p-5 text-[15px] sm:text-[16px] leading-relaxed tracking-wide ${
                      m.role === 'user' 
                      ? 'bg-white text-black font-medium rounded-[32px] rounded-tr-[10px] shadow-2xl' 
                      : 'text-gray-100 bg-transparent rounded-[32px] px-1'
                    }`}>
                      {m.role === 'user' ? m.content : <FormattedText text={m.content} />}
                      {m.isStreaming && <span className="inline-block w-2 h-4 bg-indigo-400 ml-1 animate-pulse align-middle" />}
                    </div>
                  )}

                  {/* Sources display */}
                  {m.sources && m.sources.length > 0 && !m.isStreaming && (
                    <div className="mt-3 flex flex-wrap gap-2 px-1">
                      {m.sources.map((s, si) => (
                        <a key={si} href={s.uri} target="_blank" rel="noopener noreferrer" 
                           className="text-[11px] bg-[#111] border border-white/10 text-gray-400 px-3 py-1.5 rounded-full hover:text-white hover:bg-[#222] transition-colors flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-indigo-400" />
                          <span className="max-w-[150px] truncate">{s.title || 'Source'}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Input Area */}
      <div className="fixed bottom-6 left-0 right-0 px-4 sm:px-8 z-20 pointer-events-none">
        <div className="max-w-3xl mx-auto relative pointer-events-auto">
          <div className={`bg-[#0c0c0c]/80 backdrop-blur-xl border ${isListening ? 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-white/10 shadow-2xl'} rounded-[32px] p-2 flex items-end transition-all duration-300`}>
            
            <button 
              onClick={toggleMic} 
              className={`p-3.5 m-1 rounded-full transition-all shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
            >
              {isListening ? <StopCircle size={22} /> : <Mic size={22} />}
            </button>
            
            <textarea
              ref={textareaRef}
              rows="1"
              placeholder={isListening ? "Listening closely..." : "Message Proxis..."}
              className="flex-1 bg-transparent border-none focus:outline-none px-3 py-4 text-[15px] placeholder:text-gray-600 text-white resize-none max-h-[150px] custom-scrollbar"
              value={inputValue}
              onChange={handleInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={{ minHeight: '56px' }}
            />

            <div className="flex items-center gap-1 shrink-0 p-1">
              {isSpeaking && (
                <button onClick={() => window.speechSynthesis.cancel()} className="p-3 text-indigo-400 animate-pulse bg-indigo-500/10 rounded-full mr-1">
                  <Volume2 size={20} />
                </button>
              )}
              <button 
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isThinking || (messages.length > 0 && messages[messages.length-1].isStreaming)}
                className={`p-3.5 rounded-full transition-all duration-300 ${inputValue.trim() ? 'bg-white text-black shadow-lg scale-100' : 'text-gray-700 bg-transparent scale-95'}`}
              >
                <ArrowUp size={22} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* Custom smooth scrollbars */
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }
        
        /* Disable iOS textarea zoom */
        textarea { font-size: 16px !important; }
      `}</style>
    </div>
  );
};

export default App;
