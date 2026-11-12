import { useEffect, useRef } from 'react';

// Leaflet vem do <script> no index.html (window.L), com tiles do OpenStreetMap.

const BRAZIL = [-14.235, -51.925];

function startIcon(L) {
  return L.divIcon({ className: 'map-pin-start', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] });
}

function stopIcon(L, label) {
  return L.divIcon({
    className: label ? 'map-pin-stop' : 'map-pin-draft',
    html: `<span><b>${label ?? ''}</b></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/**
 * @param {{start: {lat:number, lon:number}|null, draftStops: {lat:number, lon:number, title:string}[], result: object|null}} props
 */
export default function MapView({ start, draftStops, result }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const L = typeof window !== 'undefined' ? window.L : null;

  useEffect(() => {
    if (!L || mapRef.current) return undefined;
    const map = L.map(elementRef.current, { zoomControl: false }).setView(BRAZIL, 4);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // O mapa precisa recalcular o tamanho quando o layout muda (celular girando, etc.)
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(elementRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [L]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds = [];
    const routeStart = result ? result.start : start;
    const stops = result ? result.stops : draftStops;

    if (result) {
      const line = result.geometry
        ? result.geometry.coordinates.map(([lon, lat]) => [lat, lon])
        : [result.start, ...result.stops].map((p) => [p.lat, p.lon]);
      // Rua escura com a faixa amarela por cima, como no painel
      L.polyline(line, { color: '#26323a', weight: 9, opacity: 0.9, lineCap: 'round' }).addTo(layer);
      L.polyline(line, { color: '#f5b700', weight: 2.5, dashArray: '8 10', lineCap: 'butt' }).addTo(layer);
      bounds.push(...line);
    }

    if (routeStart) {
      L.marker([routeStart.lat, routeStart.lon], { icon: startIcon(L), title: 'Partida', zIndexOffset: 1000 })
        .bindTooltip('Partida', { direction: 'top', offset: [0, -12] })
        .addTo(layer);
      bounds.push([routeStart.lat, routeStart.lon]);
    }

    stops.forEach((stop, index) => {
      L.marker([stop.lat, stop.lon], { icon: stopIcon(L, result ? index + 1 : null), title: stop.title })
        .bindTooltip(stop.title, { direction: 'top', offset: [0, -14] })
        .addTo(layer);
      bounds.push([stop.lat, stop.lon]);
    });

    if (bounds.length === 1) map.setView(bounds[0], 15);
    else if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 16 });
  }, [L, start, draftStops, result]);

  if (!L) {
    return <div className="map map-unavailable">O mapa não carregou. Verifique sua conexão.</div>;
  }
  return <div ref={elementRef} className="map" role="region" aria-label="Mapa da rota" />;
}
