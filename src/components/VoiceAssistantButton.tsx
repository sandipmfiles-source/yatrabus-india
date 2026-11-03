import React, { useRef, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface Props {
  language: 'en' | 'hi' | 'bn';
  onTranscript: (text: string) => void;
}

const speechLocales = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN' } as const;
const copy = {
  en: { start: 'Speak your bus search', stop: 'Stop listening', unsupported: 'Voice input is not supported on this device. You can type your search.', listening: 'Listening…' },
  hi: { start: 'बोलकर बस खोजें', stop: 'सुनना बंद करें', unsupported: 'इस डिवाइस पर आवाज़ से खोज उपलब्ध नहीं है। आप लिखकर खोज सकते हैं।', listening: 'सुन रहा है…' },
  bn: { start: 'কথা বলে বাস খুঁজুন', stop: 'শোনা বন্ধ করুন', unsupported: 'এই ডিভাইসে ভয়েস ইনপুট নেই। আপনি লিখে খুঁজতে পারেন।', listening: 'শুনছি…' },
};

export const VoiceAssistantButton: React.FC<Props> = ({ language, onTranscript }) => {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognitionRef = useRef<any>(null);

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage(copy[language].unsupported);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = speechLocales[language];
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) {
        onTranscript(transcript);
        setMessage(transcript);
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(transcript);
          utterance.lang = speechLocales[language];
          window.speechSynthesis.speak(utterance);
        }
      }
    };
    recognition.onerror = () => setMessage(copy[language].unsupported);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); setMessage(copy[language].listening); }
    catch { setListening(false); setMessage(copy[language].unsupported); }
  };

  return (
    <div className="space-y-1">
      <button type="button" onClick={toggle} aria-pressed={listening} className="inline-flex items-center gap-2 rounded-xl border border-yatriwarm-300 bg-white px-3 py-2 text-sm font-semibold text-yatriwarm-900 hover:bg-yatriwarm-50">
        {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {listening ? copy[language].stop : copy[language].start}
        <Volume2 className="h-4 w-4" />
      </button>
      {message && <p role="status" aria-live="polite" className="text-xs text-yatriwarm-600">{message}</p>}
    </div>
  );
};
