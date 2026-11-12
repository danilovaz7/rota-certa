// Busca de endereços, tudo gratuito e sem chave de API:
//  - Photon (komoot): sugestões enquanto a pessoa digita (feito para autocomplete).
//  - Nominatim (OpenStreetMap): busca final de um texto que não foi escolhido da lista.
//    Política do Nominatim: no máximo 1 requisição por segundo, sem autocomplete.

const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const COUNTRY = 'BR'; // deixe '' para aceitar endereços de qualquer país
const NOMINATIM_INTERVAL_MS = 1100;
const CACHE_KEY = 'rota-certa:geocode:v2';

/** @typedef {{lat:number, lon:number, title:string, subtitle:string}} Place */

// ---------- sugestões (Photon) ----------

function photonPlace(feature) {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  const street = p.street ? `${p.street}${p.housenumber ? `, ${p.housenumber}` : ''}` : '';
  const isPoi = p.name && p.name !== p.street;
  const title = isPoi ? p.name : street || p.name || '';
  const area = [isPoi ? street : '', p.district || p.locality, p.city, p.state]
    .filter((part, i, all) => part && all.indexOf(part) === i && part !== title);
  return { lat, lon, title, subtitle: area.join(', ') };
}

/**
 * @param {string} query
 * @param {{near?: {lat:number, lon:number}, signal?: AbortSignal}} options
 * @returns {Promise<Place[]>}
 */
export async function suggestPlaces(query, { near, signal } = {}) {
  const params = new URLSearchParams({ q: query, limit: '8', lang: 'default' });
  if (near) {
    params.set('lat', near.lat.toFixed(5));
    params.set('lon', near.lon.toFixed(5));
  }
  const response = await fetch(`${PHOTON}?${params}`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  const seen = new Set();
  return data.features
    .filter((f) => !COUNTRY || f.properties.countrycode === COUNTRY)
    .map(photonPlace)
    .filter((place) => {
      const key = `${place.title}|${place.subtitle}`;
      if (!place.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

// ---------- busca de texto livre (Nominatim) ----------

let lastNominatimAt = 0;
const cache = loadCache();

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // sem armazenamento disponível: segue sem cache
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Converte um endereço digitado em coordenadas.
 * @returns {Promise<Place | null>}
 */
export async function geocode(query, { near } = {}) {
  const key = query.trim().toLowerCase();
  if (cache[key]) return cache[key];

  const wait = lastNominatimAt + NOMINATIM_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
    'accept-language': 'pt-BR',
  });
  if (COUNTRY) params.set('countrycodes', COUNTRY.toLowerCase());
  if (near) {
    const d = 0.5; // prioriza ~50 km ao redor, sem excluir o resto
    params.set('viewbox', `${near.lon - d},${near.lat + d},${near.lon + d},${near.lat - d}`);
  }

  let response;
  try {
    response = await fetch(`${NOMINATIM}?${params}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Sem conexão com a busca de endereços. Verifique sua internet e tente de novo.');
  } finally {
    lastNominatimAt = Date.now();
  }
  if (!response.ok) {
    throw new Error(`A busca de endereços recusou o pedido (HTTP ${response.status}). Tente de novo em alguns segundos.`);
  }

  const hit = (await response.json())[0];
  if (!hit) return null;

  const a = hit.address || {};
  const road = a.road ? `${a.road}${a.house_number ? `, ${a.house_number}` : ''}` : '';
  const place = {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    title: road || hit.name || query,
    subtitle: [a.suburb, a.city || a.town || a.village, a.state].filter(Boolean).join(', '),
  };
  cache[key] = place;
  saveCache();
  return place;
}
