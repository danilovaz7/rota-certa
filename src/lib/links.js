// Links para abrir a rota em apps de navegação. Não precisam de chave de API.

// O Google Maps aceita até 9 paradas intermediárias por link (limite do app no celular).
// Com mais paradas, a rota é dividida em partes: cada parte começa onde a anterior terminou.
const GOOGLE_MAX_WAYPOINTS = 9;

const fmt = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;

/**
 * @param {{lat:number, lon:number}} start ponto de partida
 * @param {{lat:number, lon:number}[]} stops paradas já na ordem otimizada
 * @returns {{url:string, from:number, to:number}[]} from/to = números das paradas (1 = primeira)
 */
export function googleMapsLinks(start, stops) {
  const links = [];
  let origin = start;
  let i = 0;
  while (i < stops.length) {
    const chunk = stops.slice(i, i + GOOGLE_MAX_WAYPOINTS + 1);
    const destination = chunk[chunk.length - 1];
    const waypoints = chunk.slice(0, -1);
    const params = new URLSearchParams({
      api: '1',
      origin: fmt(origin),
      destination: fmt(destination),
      travelmode: 'driving',
    });
    if (waypoints.length) params.set('waypoints', waypoints.map(fmt).join('|'));
    links.push({ url: `https://www.google.com/maps/dir/?${params}`, from: i + 1, to: i + chunk.length });
    origin = destination;
    i += chunk.length;
  }
  return links;
}

/** O Waze só aceita um destino por link, então é um link por parada. */
export function wazeLink(point) {
  return `https://waze.com/ul?ll=${fmt(point)}&navigate=yes`;
}

/** Abre uma única parada no Google Maps. */
export function googleMapsPointLink(point) {
  const params = new URLSearchParams({ api: '1', destination: fmt(point), travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${params}`;
}
