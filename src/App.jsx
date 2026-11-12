import { useEffect, useMemo, useRef, useState } from 'react';
import AddressInput from './components/AddressInput.jsx';
import MapView from './components/MapView.jsx';
import RouteResult from './components/RouteResult.jsx';
import { useGeolocation } from './lib/useGeolocation.js';
import { geocode } from './lib/geocode.js';
import { planRoute } from './lib/optimize.js';

const MAX_STOPS = 60;

let nextId = 1;
const newStop = () => ({ id: `parada-${nextId++}`, text: '', place: null });

function RemoveIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

export default function App() {
  const geo = useGeolocation();
  const [stops, setStops] = useState(() => [newStop(), newStop()]);
  const [manualStart, setManualStart] = useState(null); // null = sair da localização do GPS
  const [phase, setPhase] = useState('edit'); // 'edit' | 'working' | 'result'
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const inputRefs = useRef(new Map());
  const focusNext = useRef(null);

  const startPoint = manualStart ? manualStart.place : geo.position;
  const draftStops = useMemo(() => stops.filter((s) => s.place).map((s) => s.place), [stops]);
  const filled = stops.filter((s) => s.text.trim());

  useEffect(() => {
    if (focusNext.current) {
      inputRefs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  }, [stops]);

  function updateStop(id, patch) {
    setStops((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setError('');
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
    setPhase('working');
    try {
      setProgress('Localizando a partida');
      const start = await resolveStart();
      const planned = await planRoute(start, filled, setProgress);
      setResult(planned);
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
          <RouteResult result={result} onEdit={() => setPhase('edit')} />
        ) : (
          <section className="planner" aria-labelledby="planner-title">
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
                <button type="button" className="add-button" onClick={addStop}>
                  Adicionar endereço
                </button>
              </li>
            </ol>

            {error && <p className="error" role="alert">{error}</p>}

            <div className="action-bar">
              <button
                type="button"
                className="button button-primary button-large"
                onClick={optimize}
                disabled={working}
                aria-busy={working}
              >
                {working ? `${progress}…` : 'Otimizar rota'}
              </button>
            </div>
          </section>
        )}
      </aside>

      <main className="map-area">
        <MapView start={startPoint} draftStops={draftStops} result={phase === 'result' ? result : null} />
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
