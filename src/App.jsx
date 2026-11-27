import { useEffect, useMemo, useRef, useState } from 'react';
import AddressInput from './components/AddressInput.jsx';
import MapView from './components/MapView.jsx';
import RouteResult from './components/RouteResult.jsx';
import { useGeolocation } from './lib/useGeolocation.js';
import { geocode } from './lib/geocode.js';
import { planRoute } from './lib/optimize.js';
import { parseAddressList, cleanSpoken, isStopCommand, normalize } from './lib/parseList.js';
import { useSpeech } from './lib/useSpeech.js';
import { loadState, saveState, clearState } from './lib/storage.js';

const MAX_STOPS = 60;

// Ids únicos mesmo entre sessões salvas (crypto.randomUUID não existe fora de HTTPS)
let nextId = 1;
const idPrefix = Date.now().toString(36);
const newStop = (text = '') => ({ id: `parada-${idPrefix}-${nextId++}`, text, place: null });

const saved = loadState();

function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="mic-icon">
      <rect x="7" y="2.5" width="6" height="10" rx="3" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

export default function App() {
  const geo = useGeolocation();
  const [stops, setStops] = useState(() => (saved?.stops?.length ? saved.stops : [newStop(), newStop()]));
  const [manualStart, setManualStart] = useState(() => saved?.manualStart ?? null); // null = GPS
  const [roundTrip, setRoundTrip] = useState(() => Boolean(saved?.roundTrip));
  const [result, setResult] = useState(() => saved?.result ?? null);
  const [done, setDone] = useState(() => saved?.done ?? []); // ids das paradas já feitas
  const [phase, setPhase] = useState(() => (saved?.result && saved?.phase === 'result' ? 'result' : 'edit'));
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [hint, setHint] = useState('');
  const [lastHeard, setLastHeard] = useState('');
  const inputRefs = useRef(new Map());
  const focusNext = useRef(null);

  const startPoint = manualStart ? manualStart.place : geo.position;
  // Só muda quando um endereço é confirmado; digitar não faz o mapa reenquadrar a cada tecla
  const locatedKey = stops.map((s) => (s.place ? `${s.place.lat},${s.place.lon}` : '')).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draftStops = useMemo(() => stops.filter((s) => s.place).map((s) => s.place), [locatedKey]);
  const filled = stops.filter((s) => s.text.trim());

  // A voz chega fora do ciclo do React: os refs dão a lista e a partida atuais
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const startRef = useRef(startPoint);
  startRef.current = startPoint;
  const speech = useSpeech({ onPhrase: handlePhrase });

  // Cada frase falada vira uma parada e já é localizada no mapa
  function handlePhrase(raw) {
    if (isStopCommand(raw)) {
      speech.stop();
      return;
    }
    const text = cleanSpoken(raw);
    if (text.length < 3) return;
    const current = stopsRef.current;
    if (current.some((s) => s.text.trim() && normalize(s.text) === normalize(text))) {
      setLastHeard(`${text} (já estava na lista)`);
      return;
    }
    if (current.filter((s) => s.text.trim()).length >= MAX_STOPS) {
      setError(`O limite é de ${MAX_STOPS} paradas por rota.`);
      speech.stop();
      return;
    }
    const stop = newStop(text);
    setStops((list) => {
      const empty = list.findIndex((s) => !s.text.trim());
      if (empty < 0) return [...list, stop];
      const copy = [...list];
      copy[empty] = stop;
      return copy;
    });
    setLastHeard(text);
    setError('');
    geocode(text, { near: startRef.current })
      .then((place) => {
        if (!place) return;
        setStops((list) =>
          list.map((s) => (s.id === stop.id && s.text === text && !s.place ? { ...s, place } : s)),
        );
      })
      .catch(() => {
        // sem problema: o endereço é procurado de novo ao otimizar
      });
  }

  function toggleVoice() {
    if (speech.listening) {
      speech.stop();
    } else {
      setLastHeard('');
      setPasteOpen(false);
      speech.start();
    }
  }

  // Salva tudo no aparelho a cada mudança (a fase 'working' é salva como 'edit')
  useEffect(() => {
    saveState({ stops, manualStart, roundTrip, result, done, phase: phase === 'result' ? 'result' : 'edit' });
  }, [stops, manualStart, roundTrip, result, done, phase]);

  useEffect(() => {
    if (focusNext.current) {
      inputRefs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  }, [stops]);

  function updateStop(id, patch) {
    setStops((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setError('');
    setHint('');
  }

  function addStop() {
    if (stops.length >= MAX_STOPS) {
      setError(`O limite é de ${MAX_STOPS} paradas por rota.`);
      return;
    }
    const stop = newStop();
    focusNext.current = stop.id;
    setStops((list) => [...list, stop]);
  }

  function addPasted() {
    const lines = parseAddressList(pasteText);
    if (!lines.length) {
      setError('Não achamos endereços no texto. Coloque um endereço por linha.');
      return;
    }
    const already = new Set(stops.map((s) => s.text.trim().toLowerCase()).filter(Boolean));
    const fresh = lines.filter((line) => !already.has(line.toLowerCase()));
    const kept = stops.filter((s) => s.text.trim());
    const room = MAX_STOPS - kept.length;
    const added = fresh.slice(0, room).map((line) => newStop(line));
    setStops([...kept, ...added].length ? [...kept, ...added] : [newStop()]);
    setPasteText('');
    setPasteOpen(false);
    const skipped = lines.length - fresh.length;
    const cut = fresh.length - added.length;
    setError(
      cut > 0
        ? `Entraram ${added.length} endereços; ${cut} ficaram de fora pelo limite de ${MAX_STOPS} paradas.`
        : '',
    );
    setHint(skipped > 0 ? `${skipped} repetido${skipped > 1 ? 's' : ''} ignorado${skipped > 1 ? 's' : ''}` : '');
  }

  function newRoute() {
    clearState();
    setStops([newStop(), newStop()]);
    setResult(null);
    setDone([]);
    setError('');
    setPhase('edit');
  }

  function toggleDone(id) {
    setDone((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  function removeStop(id) {
    setStops((list) => (list.length === 1 ? [newStop()] : list.filter((s) => s.id !== id)));
  }

  // Enter no último campo cria uma parada nova; nos outros, pula para o próximo
  function handleEnter(index) {
    if (index === stops.length - 1) {
      if (stops[index].text.trim()) addStop();
    } else {
      inputRefs.current.get(stops[index + 1].id)?.focus();
    }
  }

  async function resolveStart() {
    if (!manualStart) {
      if (geo.position) return { ...geo.position, title: 'Sua localização', subtitle: '' };
      throw new Error('Precisamos saber de onde você sai: permita a localização no navegador ou digite o ponto de partida.');
    }
    if (manualStart.place) return manualStart.place;
    if (!manualStart.text.trim()) throw new Error('Digite o endereço de partida.');
    const place = await geocode(manualStart.text, { near: geo.position });
    if (!place) throw new Error('Não encontramos o ponto de partida. Digite de novo e escolha uma sugestão.');
    return place;
  }

  async function optimize() {
    if (!filled.length) {
      setError('Adicione pelo menos um endereço.');
      inputRefs.current.get(stops[0].id)?.focus();
      return;
    }
    setError('');
    speech.stop();
    setPhase('working');
    try {
      setProgress('Localizando a partida');
      const start = await resolveStart();
      const planned = await planRoute(start, filled, setProgress, { roundTrip });
      // Endereços sem coordenadas que foram encontrados agora ficam confirmados na lista
      const found = new Map(planned.stops.map((p) => [p.id, p]));
      setStops((list) =>
        list.map((s) => {
          const p = found.get(s.id);
          if (s.place || !p) return s;
          const { id, typed, ...place } = p; // eslint-disable-line no-unused-vars
          return { ...s, place };
        }),
      );
      setResult(planned);
      setDone([]);
      setPhase('result');
    } catch (err) {
      setError(err.message || 'Não foi possível calcular a rota. Tente de novo.');
      setPhase('edit');
    }
  }

  const working = phase === 'working';

  return (
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <div className="brand-sign">
            <span className="brand-name">Rota Certa</span>
          </div>
        </header>

        {phase === 'result' && result ? (
          <RouteResult
            result={result}
            done={done}
            onToggleDone={toggleDone}
            onEdit={() => setPhase('edit')}
            onNewRoute={newRoute}
          />
        ) : (
          <section className="planner" aria-labelledby="planner-title">
            {result && (
              <button type="button" className="back-button" onClick={() => setPhase('result')}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" /></svg>
                Voltar para a rota calculada
              </button>
            )}
            <h1 id="planner-title" className="planner-title">Para onde você vai hoje?</h1>
            <p className="planner-lead">
              Adicione os endereços em qualquer ordem. O app encontra a sequência com menos quilômetros,
              saindo de onde você está.
            </p>

            <ol className="road">
              <li className="road-node node-start">
                <span className="marker marker-start" aria-hidden="true" />
                <div className="node-body">
                  {manualStart ? (
                    <>
                      <AddressInput
                        label="Ponto de partida"
                        placeholder="Endereço de partida"
                        value={manualStart.text}
                        place={manualStart.place}
                        near={geo.position}
                        autoFocus
                        onChange={(text) => setManualStart({ text, place: null })}
                        onSelect={(place) => setManualStart({ text: place.title, place })}
                        onEnter={() => inputRefs.current.get(stops[0].id)?.focus()}
                      />
                      <button type="button" className="text-button" onClick={() => setManualStart(null)}>
                        Sair da minha localização
                      </button>
                    </>
                  ) : (
                    <GpsStatus geo={geo} onManual={() => setManualStart({ text: '', place: null })} />
                  )}
                </div>
              </li>

              {stops.map((stop, index) => (
                <li className="road-node" key={stop.id}>
                  <span className={`marker ${stop.place ? 'marker-located' : ''}`} aria-hidden="true" />
                  <div className="node-body node-row">
                    <AddressInput
                      label={`Endereço ${index + 1}`}
                      placeholder={index === 0 ? 'Rua, número e cidade' : 'Outro endereço'}
                      value={stop.text}
                      place={stop.place}
                      near={startPoint}
                      inputRef={(el) => {
                        if (el) inputRefs.current.set(stop.id, el);
                        else inputRefs.current.delete(stop.id);
                      }}
                      onChange={(text) => updateStop(stop.id, { text, place: null })}
                      onSelect={(place) => updateStop(stop.id, { text: place.title, place })}
                      onEnter={() => handleEnter(index)}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remover endereço ${index + 1}`}
                      onClick={() => removeStop(stop.id)}
                    >
                      <RemoveIcon />
                    </button>
                  </div>
                </li>
              ))}

              <li className="road-node node-add">
                <span className="marker marker-add" aria-hidden="true">+</span>
                <div className="add-row">
                  <button type="button" className="add-button" onClick={addStop}>
                    Adicionar endereço
                  </button>
                  {speech.supported && (
                    <button
                      type="button"
                      className={`text-button voice-button ${speech.listening ? 'is-listening' : ''}`}
                      aria-pressed={speech.listening}
                      onClick={toggleVoice}
                    >
                      <MicIcon />
                      {speech.listening ? 'Parar de ouvir' : 'Falar'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-button"
                    aria-expanded={pasteOpen}
                    onClick={() => setPasteOpen((open) => !open)}
                  >
                    Colar lista
                  </button>
                </div>
              </li>
            </ol>

            {speech.error && <p className="error" role="alert">{speech.error}</p>}

            {pasteOpen && (
              <div className="paste-box">
                <label htmlFor="paste-list" className="paste-label">
                  Cole os endereços, um por linha (pode ser do WhatsApp ou de uma planilha)
                </label>
                <textarea
                  id="paste-list"
                  rows={6}
                  autoFocus
                  value={pasteText}
                  placeholder={'Rua Azevedo Sodré, 120, Santos\nAv. Ana Costa, 300, Santos\n…'}
                  onChange={(event) => setPasteText(event.target.value)}
                />
                <div className="paste-actions">
                  <button type="button" className="button button-primary" onClick={addPasted}>
                    Adicionar {parseAddressList(pasteText).length || ''} endereços
                  </button>
                  <button type="button" className="button button-quiet" onClick={() => setPasteOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <label className="option">
              <input type="checkbox" checked={roundTrip} onChange={(event) => setRoundTrip(event.target.checked)} />
              <span>Voltar ao ponto de partida no fim</span>
            </label>

            {error && <p className="error" role="alert">{error}</p>}
            {!error && hint && <p className="hint" role="status">{hint}</p>}

            <div className="action-bar">
              {speech.listening ? (
                <div className="voice-box" role="status" aria-live="polite">
                  <span className="voice-pulse" aria-hidden="true"><MicIcon /></span>
                  <div className="voice-text">
                    <strong>{speech.interim ? `“${speech.interim}”` : 'Ouvindo…'}</strong>
                    <span>
                      Fale um endereço por vez, com rua, número e cidade. Diga “pronto” para terminar.
                    </span>
                    {lastHeard && <span className="voice-last">Adicionado: {lastHeard}</span>}
                  </div>
                  <button type="button" className="button button-outline voice-stop" onClick={speech.stop}>
                    Parar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="button button-primary button-large"
                  onClick={optimize}
                  disabled={working}
                  aria-busy={working}
                >
                  {working
                    ? `${progress}…`
                    : `Otimizar rota${filled.length > 1 ? ` (${filled.length} endereços)` : ''}`}
                </button>
              )}
            </div>
          </section>
        )}
      </aside>

      <main className="map-area">
        <MapView
          start={startPoint}
          draftStops={draftStops}
          result={phase === 'result' ? result : null}
          done={done}
        />
      </main>
    </div>
  );
}

function GpsStatus({ geo, onManual }) {
  if (geo.status === 'ok') {
    return (
      <div className="gps">
        <strong className="node-title">Sua localização</strong>
        {geo.accuracy >= 1 && (
          <span className="node-subtitle">Precisão de cerca de {Math.round(geo.accuracy)} m</span>
        )}
        <button type="button" className="text-button" onClick={onManual}>Sair de outro endereço</button>
      </div>
    );
  }
  if (geo.status === 'loading') {
    return (
      <div className="gps">
        <strong className="node-title">Procurando sua localização</strong>
        <span className="node-subtitle">Se o navegador perguntar, toque em permitir.</span>
        <button type="button" className="text-button" onClick={onManual}>Digitar o ponto de partida</button>
      </div>
    );
  }
  const message = {
    denied: 'A localização está bloqueada neste navegador.',
    error: 'Não foi possível encontrar sua localização.',
    unsupported: 'Este navegador não informa a localização.',
  }[geo.status];
  return (
    <div className="gps gps-problem">
      <strong className="node-title">{message}</strong>
      <span className="gps-actions">
        <button type="button" className="text-button" onClick={onManual}>Digitar o ponto de partida</button>
        {geo.status !== 'unsupported' && (
          <button type="button" className="text-button" onClick={geo.locate}>Tentar de novo</button>
        )}
      </span>
    </div>
  );
}
