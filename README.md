# Rota Certa

App web que recebe endereços **em qualquer ordem** e calcula a sequência com **menos quilômetros** pelas ruas, saindo da localização de quem usa. Depois abre a rota no Google Maps ou no Waze.

Feito com React + Vite. Mapas e dados gratuitos, sem chave de API.

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera a pasta dist/
npm test         # testes do algoritmo e dos links
```

A localização só funciona em `localhost` ou em HTTPS.

## Como funciona

| Etapa | Serviço | Arquivo |
|---|---|---|
| Sugestões enquanto digita | [Photon](https://photon.komoot.io) | `src/lib/geocode.js` |
| Endereço digitado sem escolher sugestão | [Nominatim](https://nominatim.org) | `src/lib/geocode.js` |
| Distância real entre todos os pontos | [OSRM](https://project-osrm.org) | `src/lib/routing.js` |
| Melhor ordem (caixeiro viajante, início fixo, sem volta) | próprio | `src/lib/tsp.js` |
| Mapa | [Leaflet](https://leafletjs.com) + OpenStreetMap | `src/components/MapView.jsx` |
| Links do Google Maps e do Waze | URLs públicas | `src/lib/links.js` |

O algoritmo testa todas as ordens até 9 paradas (resultado ótimo garantido). Acima disso usa vizinho mais próximo + 2-opt + Or-opt com reinícios (busca local iterada): nos testes chegou ao ótimo em todos os casos de 10 paradas e resolve 60 paradas em menos de meio segundo.

O Waze só aceita um destino por link, então cada parada tem seu próprio botão. O Google Maps aceita até 10 paradas por link; rotas maiores são divididas em partes.

## Estrutura

```
src/
  App.jsx                    tela de planejamento e fluxo principal
  components/AddressInput.jsx  campo com sugestões (navegável pelo teclado)
  components/RouteResult.jsx   tela da rota otimizada
  components/MapView.jsx       mapa Leaflet
  lib/optimize.js            junta tudo: localiza, mede, ordena, traça
  lib/geocode.js, routing.js, tsp.js, links.js, useGeolocation.js
  styles.css                 visual (cores de placa de trânsito, fonte Overpass)
tests/                       node --test
```

## Limites dos serviços gratuitos

Photon, Nominatim, OSRM e os tiles do OpenStreetMap são servidores públicos para uso leve. Se o app crescer, dá para hospedar OSRM e Photon próprios (Docker) e trocar as URLs em `src/lib/`.
