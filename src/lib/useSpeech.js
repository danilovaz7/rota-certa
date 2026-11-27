import { useCallback, useEffect, useRef, useState } from 'react';

// Reconhecimento de voz do próprio navegador (Web Speech API): gratuito e sem chave.
// Funciona no Chrome (Android e computador), no Edge e no Safari do iPhone (14.5+).
// O Firefox não tem. Como a localização, só funciona em localhost ou HTTPS.
const Recognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const speechSupported = Boolean(Recognition);

const MESSAGES = {
  'not-allowed': 'O microfone está bloqueado. Permita o acesso ao microfone nas configurações do navegador.',
  'service-not-allowed': 'O microfone está bloqueado. Permita o acesso ao microfone nas configurações do navegador.',
  'audio-capture': 'Não encontramos um microfone neste aparelho.',
  network: 'O reconhecimento de voz precisa de internet. Verifique a conexão e tente de novo.',
};

/**
 * Ouve uma frase por vez e chama onPhrase com o texto final de cada uma.
 * Fica ouvindo até stop() ser chamado: cada vez que o navegador encerra (silêncio),
 * reinicia sozinho. Uma frase por sessão evita o bug do Android que repete resultados
 * quando o modo contínuo está ligado.
 */
export function useSpeech({ onPhrase, lang = 'pt-BR' }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const wantedRef = useRef(false);
  const onPhraseRef = useRef(onPhrase);
  onPhraseRef.current = onPhrase;

  const stop = useCallback(() => {
    wantedRef.current = false;
    setListening(false);
    setInterim('');
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  const listenOnce = useCallback(() => {
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let partial = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setInterim('');
          if (text.trim()) onPhraseRef.current(text.trim());
        } else {
          partial += text;
        }
      }
      if (partial) setInterim(partial);
    };

    recognition.onerror = (event) => {
      // 'no-speech' e 'aborted' são normais: a pessoa ficou em silêncio ou paramos de propósito
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(MESSAGES[event.error] || 'Não foi possível usar o microfone agora. Tente de novo.');
      wantedRef.current = false;
    };

    recognition.onend = () => {
      if (wantedRef.current && recognitionRef.current === recognition) {
        // reinicia para a próxima frase
        setTimeout(() => {
          if (wantedRef.current && recognitionRef.current === recognition) listenOnce();
        }, 150);
      } else if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setListening(false);
        setInterim('');
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      stop();
    }
  }, [lang, stop]);

  const start = useCallback(() => {
    if (!Recognition || wantedRef.current) return;
    setError('');
    wantedRef.current = true;
    setListening(true);
    listenOnce();
  }, [listenOnce]);

  // Para de ouvir se o componente sair da tela ou a aba for para segundo plano
  useEffect(() => {
    const onHide = () => document.hidden && stop();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      stop();
    };
  }, [stop]);

  return { supported: speechSupported, listening, interim, error, start, stop };
}
