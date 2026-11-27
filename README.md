# Rota Certa

App web que recebe endereços **em qualquer ordem** e calcula a sequência com **menos quilômetros** pelas ruas, saindo da localização de quem usa. Depois abre a rota no Google Maps ou no Waze.

Feito com React + Vite. Mapas e dados gratuitos, sem chave de API.

## O que ele faz

- **Colar lista**: cole vários endereços de uma vez (do WhatsApp, de uma planilha), um por linha. Numeração, marcadores e repetidos são removidos.
- **Ida e volta**: opção para voltar ao ponto de partida no fim; a ordem é otimizada contando a volta.
- **Modo entrega**: depois de calcular, o app mostra a próxima parada com o botão do Waze; toque em "Cheguei" e ele passa para a seguinte. O link do Google Maps sempre traz só o que falta.
- **Não perde a rota**: tudo fica salvo no aparelho. No celular, ao abrir o Waze o navegador costuma descarregar a aba; ao voltar, a rota e o progresso continuam lá (rotas com mais de 3 dias são descartadas).
- **Instalável**: tem manifest de PWA, então dá para "Adicionar à tela inicial".

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
| Endereço digitado sem escolher sugestão | Photon e, se não achar, [Nominatim](https://nominatim.org) | `src/lib/geocode.js` |
| Distância real entre todos os pontos | [OSRM](https://project-osrm.org) | `src/lib/routing.js` |
| Melhor ordem (caixeiro viajante, início fixo, com ou sem volta) | próprio | `src/lib/tsp.js` |
| Lista colada → endereços | próprio | `src/lib/parseList.js` |
| Estado salvo no aparelho | localStorage | `src/lib/storage.js` |
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
  lib/parseList.js, storage.js
public/                      ícones e manifest (PWA)
  styles.css                 visual (cores de placa de trânsito, fonte Overpass)
tests/                       node --test (rodam também no GitHub Actions)
```

## Limites dos serviços gratuitos

Photon, Nominatim, OSRM e os tiles do OpenStreetMap são servidores públicos para uso leve. Se o app crescer, dá para hospedar OSRM e Photon próprios (Docker) e trocar as URLs em `src/lib/`.
