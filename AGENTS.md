# TVGames — AGENTS.md

Jeux multi-joueurs : la partie s'affiche sur une TV (`/tv`), les joueurs contrôlent depuis leur mobile (`/controller`), temps réel via WebSocket.

## Stack

- Node 26, Express 5, EJS, Tailwind CSS v4 (via `@tailwindcss/cli`), `ws` (WebSocket), `dotenv`
- Scores persistés en SQLite via `better-sqlite3` (`lib/db.js`, fichier `data/` gitignoré, `DB_PATH` configurable, joueurs + historique des matchs, classements global et par jeu sur `/` et `/api/scores`) — un pseudo = un joueur (fusion auto des doublons existants au boot, « Joueur » exclu)
- Port par défaut : **4444** (`.env` → `PORT`, voir `.env.example`)
- URL publique du QR TV : `PUBLIC_URL` (ex. `http://192.168.1.191:4444`, IP LAN pour les mobiles)
- Pas de DB pour l'état temps réel, en mémoire (`lib/rooms.js`) ; SQLite uniquement pour l'historique des scores
- Logs via `logxpert` (`lib/logger.js`, console only, niveau `LOG_LEVEL` ou `info`) : `info` = cycle de vie (boot, salons, joueurs, matchs), `debug` = tout le reste (HTTP, messages WS, refus, coups, transitions d'état, requêtes DB) — `LOG_LEVEL=debug` dans `.env` pour activer
- Icônes FontAwesome Free solid (package local `@fortawesome/fontawesome-free` servi sur `/fa`, pas de CDN)
- HTTP : gzip (`compression`), `/fa` limité à `css`+`webfonts` (cache immutable 1 an), WS `maxPayload` 64 Ko, arrêt propre sur SIGINT/SIGTERM (fermeture sockets + `db.close()`)

## Commandes

- `npm run dev` — watch CSS Tailwind + `node --watch server.js`
- `npm start` — build CSS minifié + serveur
- `npm run build:css` — régénère `public/css/output.css` (fichier gitignoré, toujours rebuild après ajout de classes)
- `curl http://localhost:4444/health` — check rapide

## Structure

- `server.js` — Express + HTTP + upgrade WS, routes `/`, `/tv`, `/controller` (login), `/controller/game` (salon : TV + choix du jeu), `/controller/game/:nom` (partie), `/api/games`, `/api/scores`, `/api/duel` (face-à-face `{w1, w2, draws}` pour 2 joueurs sur un jeu, `game=all` pour tous jeux), `/health`
- `lib/games.js` — registre des jeux (`lobby`, `puissance4`, `tictactoe`, `memory`, `bataille`, `uno`)
- `lib/rooms/` (`index.js` : joueurs, manches, `state()`, `duel` générique `{red, yellow, winnerId, isDraw}`) : `registry.js` (salons + `getRoom`), `code.js`, `constants.js` (`COLORS`, `SYMBOLS`, `UNO_COLORS`, `BAT_SIZE`), `games/` (un fichier par jeu + `helpers.js`), aucune socket ici
- `lib/ws/` (`index.js` : dispatch + heartbeat 30s) : `state.js` (registres, diffusion, cleanup), `lobby.js` (TV, join, create, pair-tv, leave), `game.js` (set-game → input)
- `public/js/tv/` — modules ES (`main.js` → `type="module"`) : `state.js` (état `S` + DOM), `utils.js`, `players.js`, `duel.js` (leaderboard), `games-lobby.js`, `games-p4.js`, `games-tictactoe.js`, `games-memory.js`, `games-bataille.js`, `games-uno.js`
- `public/js/controller/` — modules ES (`main.js` → `type="module"`) : `state.js` (état `S` + DOM `UI`), `utils.js`, `router.js` (History API), `join.js` (login + salons détectés), `lobby.js` (salon + suggestions), `play.js` (jeu + modales), `net.js` (WebSocket)
- `views/tv.ejs`, `views/controller.ejs`, `views/index.ejs`
- `public/js/tv/`, `public/js/controller/` — clients WS (reconnexion auto 2s) ; controller = mini-SPA (History API : `navigate()` + `render()` + `syncRoute()`, liens `data-nav`, zéro reload, une seule connexion WS ; catalogue jeux via AJAX `GET /api/games` avec fallback embarqué)

## Protocole WS (`/ws`, JSON)

- Client → serveur : `{type:'join', role:'tv'}` (TV idle), `{type:'create-room', name}` + `{type:'join', role:'player', room, ...}` (mobile), `{type:'pair-tv', tvId}` (créateur), `{type:'leave'}` (joueur), `{type:'list-rooms'}` (mobile pas en salon), `{type:'set-game', game}` / `{type:'reset-round'}` / `{type:'start-game'}` / `{type:'rematch'}` (gérant), `{type:'ready', ready}` / `{type:'rematch-decline'}` / `{type:'forfeit'}` / `{type:'suggest', game}` (joueur — propose un jeu, re-tap pour retirer), `{type:'set-color', color}` / `{type:'set-symbol', symbol}` / `{type:'place-ships', cells}` (joueur — bataille : 16 cases 5-4-3-2-2 alignées, grille 9x9), `{type:'input', action}` (joueur — `drop` P4, `cell` morpion, `flip` memory, `fire` bataille, `play`/`draw`/`pass`/`color` uno ; pour `play`/`color`, `col` transporte l'id de carte/couleur)
- Serveur → clients : `{type:'tv-idle', tvId, tvName, boot}`, `{type:'tv-paired', room, qrDataUrl, joinUrl, boot}`, `{type:'tv-list', tvs, boot}`, `{type:'rooms-list', rooms, boot}` (salons ouverts : code, jeu, nb joueurs, gérant, TV — poussé aux mobiles hors salon à chaque changement), `{type:'joined', ...}`, `{type:'room-state', ..., creatorId, pairedTv, ready, started, boot, picks}` (`picks` = `{playerId: gameId}`, reset au choix du jeu), `{type:'reload'}` (front modifié sur disque → `location.reload()` immédiat), `{type:'rematch-offer', room, from}` (proposition de revanche du gérant, modale Accepter/Refuser chez l'adversaire), `{type:'rematch-declined', room, by}` (au gérant), `{type:'room-closed', reason}`, `{type:'error', code?, message}` (`code:'room-not-found'` quand le salon n'existe plus)
- MaJ front/serveur : `boot` (id de démarrage) dans tous les messages + `?v=boot` sur CSS/JS des pages ; `boot` différent → `location.reload()` (mobile : session salon effacée, TV : `tvId` gardé) ; modif sous `public/`/`views/` → broadcast `reload` sans restart
- Flux : mobile crée le salon → choisit une TV idle dans la liste → la TV affiche jeu + QR pour le joueur 2 ; salon fermé (joueurs déconnectés, TV de nouveau idle) si la TV se déconnecte ou si le créateur quitte
- Gérant = premier joueur du salon (`hostId`), bascule auto au suivant en cas de départ ; choix du jeu sur mobile, TV en affichage seul
- Puissance 4 : double-tap sur une colonne pour valider (mobile), animation de chute du jeton (TV + mobile), le perdant commence (tirage au sort sinon, par mode de jeu)
- Morpion : 9 symboles FontAwesome (Croix, Rond, Étoile, Cœur, Triangle, Point, Lune, Éclair, Carreau), case neutre + icône colorée (couleur du joueur, comme P4), choix couleur + symbole en pré-partie
- Memory : les 2 cartes d'un mismatch se masquent toutes seules après 2 s (timer serveur, garde `shownId`), animation de retournement (`memo-flip`) et de masquage (`memo-unflip`), icônes agrandies
- TV : dès 2 joueurs, écran VS + leaderboard face-à-face (lobby = tous jeux, pré-partie = mode en cours, via `/api/duel`, cache invalidé à chaque changement d'état) ; panneau leaderboard DB à gauche en lobby + pré-partie (caché en partie) : top 5 global + top 3 par jeu avec pseudos (`public/js/tv/board.js`, via `/api/scores`)

## Ajouter un jeu

1. Entrée dans `GAMES` (`lib/games.js`)
2. État/transition dans `lib/rooms.js` (`handleInput`, `resetRound` si besoin)
3. Rendu TV dans `public/js/tv.js` (`render()`)
4. Contrôles mobile dans `public/js/controller.js` (`renderControls()`)
5. Tester : salon TV + 1 joueur, vérifier `room-state` et le rendu des deux côtés

## Règles

- Ne jamais commit/push sans demande explicite
- Code concis : pas de docstrings systématiques, pas de sur-abstraction, pas de commentaires pédagogiques
- Environnement Windows PowerShell (pas de `tail`, `&&` limité) ; tuer un serveur de test via le port, pas `taskkill /IM node.exe`
- Le QR de `/tv` dépend de `api.qrserver.com` (internet requis) — piste : génération locale
- Pas de `test` automatisé pour l'instant — `npm test` n'existe pas
