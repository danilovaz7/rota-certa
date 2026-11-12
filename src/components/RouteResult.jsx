import { useState } from 'react';
import { formatDuration, formatKm } from '../lib/optimize.js';
import { googleMapsLinks, googleMapsPointLink, wazeLink } from '../lib/links.js';

export default function RouteResult({ result, onEdit }) {
  const [copied, setCopied] = useState(false);
  const { start, stops, legs, distance, duration, typedOrderDistance, notFound, estimated } = result;
  const saving = typedOrderDistance - distance;
  const googleLinks = googleMapsLinks(start, stops);

  async function copyList() {
    const text = stops.map((s, i) => `${i + 1}. ${s.title}${s.subtitle ? `, ${s.subtitle}` : ''}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="result" aria-labelledby="result-title">
      <button type="button" className="back-button" onClick={onEdit}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" /></svg>
        Editar paradas
      </button>

      <div className="summary-sign">
        <h1 id="result-title" className="summary-distance">{formatKm(distance)}</h1>
        <p className="summary-meta">
          {formatDuration(duration)} de carro, {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
        </p>
        {stops.length > 1 && saving > 50 && (
          <p className="summary-saving">{formatKm(saving)} a menos que na ordem em que você digitou</p>
        )}
      </div>

      <div className="nav-actions">
        {googleLinks.map((link) => (
          <a key={link.url} className="button button-primary" href={link.url} target="_blank" rel="noopener">
            {googleLinks.length === 1 ? 'Abrir rota no Google Maps' : `Google Maps, paradas ${link.from} a ${link.to}`}
          </a>
        ))}
        <a className="button button-waze" href={wazeLink(stops[0])} target="_blank" rel="noopener">
          Começar no Waze
        </a>
        <p className="fine-print">
          O Waze navega para um destino por vez: ao chegar em cada parada, toque em Waze na próxima.
          {googleLinks.length > 1 && ' O Google Maps aceita até 10 paradas por link, por isso a rota foi dividida.'}
        </p>
      </div>

      <ol className="road road-result">
        <li className="road-node">
          <span className="marker marker-start" aria-hidden="true" />
          <div className="node-body">
            <strong className="node-title">{start.title}</strong>
            {start.subtitle && <span className="node-subtitle">{start.subtitle}</span>}
          </div>
        </li>
        {stops.map((stop, index) => (
          <li className="road-node" key={stop.id}>
            <span className="leg">
              {formatKm(legs[index].distance)} em {formatDuration(legs[index].duration)}
            </span>
            <span className="marker marker-diamond" aria-label={`Parada ${index + 1}`}>
              <b>{index + 1}</b>
            </span>
            <div className="node-body">
              <strong className="node-title">{stop.title}</strong>
              {stop.subtitle && <span className="node-subtitle">{stop.subtitle}</span>}
              <div className="stop-links">
                <a href={wazeLink(stop)} target="_blank" rel="noopener">Waze</a>
                <a href={googleMapsPointLink(stop)} target="_blank" rel="noopener">Google Maps</a>
              </div>
            </div>
          </li>
        ))}
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
            {notFound.length === 1 ? 'Este endereço ficou fora da rota' : 'Estes endereços ficaram fora da rota'} porque
            não foi encontrado no mapa:
          </p>
          <ul>
            {notFound.map((s) => <li key={s.id}>{s.text}</li>)}
          </ul>
          <p>Volte, digite de novo e escolha uma das sugestões da lista.</p>
        </div>
      )}

      <button type="button" className="button button-quiet" onClick={copyList}>
        {copied ? 'Lista copiada' : 'Copiar lista na ordem'}
      </button>
    </section>
  );
}
