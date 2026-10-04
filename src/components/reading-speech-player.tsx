'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { readingSpeechText, speechChunks, vietnameseVoices } from '@/lib/reading-speech';
import type { Reading } from '@/types/tarot';
import styles from './reading-speech-player.module.css';

export function ReadingSpeechPlayer({ reading }: { reading: Reading }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const session = useRef(0);
  // Retain utterances until playback ends; some engines otherwise lose them.
  const utterances = useRef<SpeechSynthesisUtterance[]>([]);
  const choices = useMemo(() => vietnameseVoices(voices), [voices]);
  const text = useMemo(() => readingSpeechText(reading), [reading]);
  const noVietnamese = voices.length > 0 && choices.length === 0;

  const cancel = useCallback(() => {
    session.current++;
    const owned = utterances.current.length > 0;
    utterances.current = [];
    if (owned) window.speechSynthesis.cancel();
  }, []);

  function stop() {
    cancel();
    setPlaying(false);
  }

  useEffect(() => {
    const available = !!window.speechSynthesis && typeof window.speechSynthesis.speak === 'function' && typeof window.SpeechSynthesisUtterance === 'function';
    setSupported(available);
    if (!available) return;
    const synth = window.speechSynthesis;
    function loadVoices() {
      const availableVoices = synth.getVoices();
      setVoices(availableVoices);
      const vietnamese = vietnameseVoices(availableVoices);
      if (vietnamese.length) setError('');
    }
    function leavePage() {
      cancel();
      setPlaying(false);
    }
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    window.addEventListener('pagehide', leavePage);
    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
      window.removeEventListener('pagehide', leavePage);
      cancel();
    };
  }, [cancel]);

  useEffect(() => {
    setPlaying(false);
    setError('');
    return cancel;
  }, [text, cancel]);

  function listen() {
    if (!supported || !text) return;
    const synth = window.speechSynthesis;
    const available = vietnameseVoices(synth.getVoices());
    const voice = available[0];
    if (!voice) {
      setError('Giọng tiếng Việt chưa sẵn sàng. Hãy đợi một chút rồi bấm nghe lại; nếu vẫn chưa có, hãy thêm tiếng Việt trong cài đặt giọng nói của thiết bị.');
      return;
    }
    cancel();
    const current = session.current;
    setError('');
    function playbackError(network = false) {
      if (session.current !== current) return;
      cancel();
      setPlaying(false);
      setError(network
        ? 'Giọng đọc này cần kết nối mạng. Hãy kiểm tra kết nối rồi thử lại.'
        : 'Chưa phát được giọng đọc. Hãy bấm nghe lại.');
    }
    try {
      const chunks = speechChunks(text);
      const queue = chunks.map((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.voice = voice;
        utterance.lang = voice.lang.replaceAll('_', '-');
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => {
          if (session.current !== current) return;
          if (index === chunks.length - 1) {
            utterances.current = [];
            setPlaying(false);
          }
        };
        utterance.onerror = event => {
          playbackError(event.error === 'network');
        };
        return utterance;
      });
      utterances.current = queue;
      setPlaying(true);
      // Let the voice engine handle punctuation, without extra timed pauses.
      for (const utterance of queue) {
        if (session.current !== current) break;
        synth.speak(utterance);
      }
    } catch {
      playbackError();
    }
  }

  return <div className={styles.player} role="group" aria-label="Nghe lời giải Tarot">
      <button type="button" className={`secondary-button ${styles.button}`} onClick={playing ? stop : listen} disabled={!supported || noVietnamese || !text} aria-pressed={playing}>
        {playing ? <Square size={16} aria-hidden="true"/> : <Volume2 size={17} aria-hidden="true"/>}{playing ? 'Dừng đọc' : 'Nghe thông điệp'}
      </button>
    <p className={styles.status} role="status">{error || (supported === false ? 'Trình duyệt này chưa hỗ trợ đọc bằng giọng nói.' : noVietnamese ? 'Thiết bị chưa có giọng tiếng Việt. Hãy thêm tiếng Việt trong cài đặt giọng nói rồi tải lại trang.' : '')}</p>
  </div>;
}
