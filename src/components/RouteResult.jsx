import { useState } from 'react';
import { formatDuration, formatKm } from '../lib/optimize.js';
import { googleMapsLinks, googleMapsPointLink, wazeLink } from '../lib/links.js';

/**
 * Tela da rota otimizada. Funciona também durante o trajeto: a pessoa marca cada parada
 * como feita e o app mostra sempre a próxima, com o botão do Waze já apontando para ela.
 */
export default function RouteResult({ result, done, onToggleDone, onEdit, onNewRoute }) {
  const [copied, setCopied] = useState(false);
  const { start, stops, legs, distance, duration, typedOrderDistance, notFound, estimated, roundTrip } = result;
  const saving = typedOrderDistance - distance;

  const doneCount = stops.filter((s) => done.includes(s.id)).length;
  const nextIndex = stops.findIndex((s) => !done.includes(s.id));
  const next = nextIndex >= 0 ? stops[nextIndex] : null;
  const finished = !next;
  const started = doneCount > 0;

  // Links do Google com o que falta. Depois da primeira parada feita, a origem fica em branco
  // para o Google sair de onde a pessoa está agora.
  const remaining = stops.filter((s) => !done.includes(s.id));
  const googleTargets = roundTrip ? [...remaining, start] : remaining;
  const googleLinks = finished && !roundTrip ? [] : googleMapsLinks(started ? null : start, googleTargets);

  async function copyList() {
    const lines = stops.map((s, i) => `${i + 1}. ${s.title}${s.subtitle ? `, ${s.subtitle}` : ''}`);
    if (roundTrip) lines.push(`Volta: ${start.title}`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="result" aria-labelledby="result-title">
      <div className="result-top">
        <button type="button" className="back-button" onClick={onEdit}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" /></svg>
          Editar paradas
        </button>
        <button type="button" className="text-button" onClick={onNewRoute}>Nova rota</button>
      </div>

      <div className="summary-sign">
        <h1 id="result-title" className="summary-distance">{formatKm(distance)}</h1>
        <p className="summary-meta">
          {formatDuration(duration)} de carro, {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
          {roundTrip && ', com volta'}
        </p>
        {stops.length > 1 && saving > 50 && (
          <p className="summary-saving">{formatKm(saving)} a menos que na ordem em que você digitou</p>
        )}
        {stops.length > 1 && (
          <div className="progress" aria-label={`${doneCount} de ${stops.length} paradas feitas`}>
            <span style={{ width: `${(100 * doneCount) / stops.length}%` }} />
          </div>
        )}
      </div>

      {next ? (
        <div className="next-card">
          <span className="next-label">
            {started ? `Próxima parada (${doneCount} de ${stops.length} feitas)` : 'Primeira parada'}
          </span>
          <strong className="next-title">
            <span className="next-number">{nextIndex + 1}</span>
            {next.title}
          </strong>
          {next.subtitle && <span className="node-subtitle">{next.subtitle}</span>}
          <div className="next-actions">
            <a className="button button-waze" href={wazeLink(next)} target="_blank" rel="noopener">
              Ir no Waze
            </a>
            <button type="button" className="button button-outline" onClick={() => onToggleDone(next.id)}>
              Cheguei
            </button>
          </div>
        </div>
      ) : (
        <div className="next-card next-card-done" role="status">
          <strong className="next-title">Todas as paradas feitas</strong>
          {roundTrip && <span className="node-subtitle">Falta só voltar ao ponto de partida.</span>}
          {roundTrip && (
            <a className="button button-waze" href={wazeLink(start)} target="_blank" rel="noopener">
              Voltar no Waze
            </a>
          )}
        </div>
      )}

      {googleLinks.length > 0 && (
        <div className="nav-actions">
          {googleLinks.map((link) => (
            <a key={link.url} className="button button-primary" href={link.url} target="_blank" rel="noopener">
              {googleLinks.length === 1
                ? started ? 'Abrir o que falta no Google Maps' : 'Abrir rota no Google Maps'
                : `Google Maps, parte ${link.from}–${link.to}`}
            </a>
          ))}
          <p className="fine-print">
            O Waze navega para um destino por vez; o Google Maps leva a rota inteira.
            {googleLinks.length > 1 && ' O Google aceita até 10 paradas por link, por isso a rota foi dividida.'}
            {' '}Pode sair e voltar: a rota fica salva neste aparelho.
          </p>
        </div>
      )}

      <ol className="road road-result">
        <li className="road-node">
          <span className="marker marker-start" aria-hidden="true" />
          <div className="node-body">
            <strong className="node-title">{start.title}</strong>
            {start.subtitle && <span className="node-subtitle">{start.subtitle}</span>}
          </div>
        </li>
        {stops.map((stop, index) => {
          const isDone = done.includes(stop.id);
          return (
            <li className={`road-node ${isDone ? 'is-done' : ''} ${stop === next ? 'is-next' : ''}`} key={stop.id}>
              <span className="leg">
                {formatKm(legs[index].distance)} em {formatDuration(legs[index].duration)}
              </span>
              <span className="marker marker-diamond" aria-hidden="true">
                <b>{index + 1}</b>
              </span>
              <div className="node-body node-row">
                <div className="stop-info">
                  <strong className="node-title">{stop.title}</strong>
                  {stop.subtitle && <span className="node-subtitle">{stop.subtitle}</span>}
                  {!isDone && (
                    <div className="stop-links">
                      <a href={wazeLink(stop)} target="_blank" rel="noopener">Waze</a>
                      <a href={googleMapsPointLink(stop)} target="_blank" rel="noopener">Google Maps</a>
                    </div>
                  )}
                </div>
                <label className="done-check">
                  <input type="checkbox" checked={isDone} onChange={() => onToggleDone(stop.id)} />
                  <span className="visually-hidden">Parada {index + 1} feita</span>
                </label>
              </div>
            </li>
          );
        })}
        {roundTrip && legs[stops.length] && (
          <li className="road-node">
            <span className="leg">
              {formatKm(legs[stops.length].distance)} em {formatDuration(legs[stops.length].duration)}
            </span>
            <span className="marker marker-start" aria-hidden="true" />
            <div className="node-body">
              <strong className="node-title">Volta à partida</strong>
              <span className="node-subtitle">{start.title}</span>
            </div>
          </li>
        )}
      </ol>

      {estimated && (
        <p className="notice" role="status">
          O serviço de rotas não respondeu, então as distâncias são estimadas em linha reta e a ordem pode
          não ser a ideal. Volte e otimize de novo em instantes.
        </p>
      )}
      {notFound.length > 0 && (
        <div className="notice" role="status">
          <p>
            {notFound.length === 1
              ? 'Este endereço ficou fora da rota porque não foi encontrado no mapa:'
              : 'Estes endereços ficaram fora da rota porque não foram encontrados no mapa:'}
          </p>
          <ul>
            {notFound.map((s) => <li key={s.id}>{s.text}</li>)}
          </ul>
          <p>Volte, digite de novo (com rua, número e cidade) e escolha uma das sugestões da lista.</p>
        </div>
      )}

      <button type="button" className="button button-quiet" onClick={copyList}>
        {copied ? 'Lista copiada' : 'Copiar lista na ordem'}
      </button>
    </section>
  );
}
