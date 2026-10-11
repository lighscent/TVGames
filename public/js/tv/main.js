import { S, checkBoot, stage, playersEl, countEl, statusEl, currentGameEl, hostNameEl, roomCodeEl } from './state.js';
import { escapeHtml } from './utils.js';
import { gameLabel, playerName } from './players.js';
import { maybeFetchDuel } from './duel.js';
import { maybeFetchBoard, withBoard } from './board.js';
import { renderIdle, renderLobby } from './games-lobby.js';
import { renderP4 } from './games-p4.js';
import { renderTictactoe } from './games-tictactoe.js';
import { renderMemory } from './games-memory.js';
import { renderBataille } from './games-bataille.js';
import { renderUno } from './games-uno.js';

function fitBoards() {
  document.querySelectorAll('[data-fit-aspect]').forEach((el) => {
    const parent = el.parentElement;
    const aspect = parseFloat(el.dataset.fitAspect);
    const width = Math.max(120, Math.min(parent.clientWidth, parent.clientHeight * aspect));
    el.style.width = `${width}px`;
  });
}
window.addEventListener('resize', fitBoards);

function render() {
  const state = S.state;
  if (!state) return;
  currentGameEl.innerHTML = gameLabel(state.game);
  hostNameEl.textContent = playerName(state.hostId);
  countEl.textContent = state.players.length;
  playersEl.innerHTML = state.players.length
    ? state.players.map((p) => `<span class="rounded-full border ${p.id === state.hostId ? 'border-amber-500' : 'border-zinc-700'} px-3 py-1 text-[1.8vmin]"><span class="mr-1 inline-block h-[1.6vmin] w-[1.6vmin] rounded-full ${p.bg || 'bg-zinc-500'}"></span>${p.id === state.hostId ? '<i class="fa-solid fa-crown"></i>' : '<i class="fa-solid fa-user"></i>'} ${escapeHtml(p.name)}</span>`).join('')
    : '<span class="text-[1.8vmin] text-zinc-600">En attente de joueurs… scannez le QR.</span>';

  if (state.players.length >= 2) maybeFetchDuel(render);

  if (state.game === 'lobby') {
    renderLobby();
  } else if (state.game === 'puissance4') {
    renderP4();
  } else if (state.game === 'tictactoe') {
    renderTictactoe();
  } else if (state.game === 'memory') {
    renderMemory();
  } else if (state.game === 'bataille') {
    renderBataille();
  } else if (state.game === 'uno') {
    renderUno();
  } else {
    stage.innerHTML = `<h2 class="text-[4vmin] font-bold">${gameLabel(state.game)}</h2>`;
  }
  if (state.game === 'lobby' || !state.started) {
    maybeFetchBoard(render);
    stage.innerHTML = withBoard(stage.innerHTML);
  }
  fitBoards();
}

function connect() {
  S.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  S.ws.onopen = () => {
    statusEl.textContent = 'connecté';
    statusEl.className = 'text-emerald-400';
    S.ws.send(JSON.stringify({ type: 'join', role: 'tv', tvId: S.tvId }));
  };
  S.ws.onclose = () => {
    statusEl.textContent = 'déconnecté — reconnexion…';
    statusEl.className = 'text-red-400';
    setTimeout(connect, 2000);
  };
  S.ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'reload') { location.reload(); return; }
    if (msg.boot && checkBoot(msg)) return;
    if (msg.type === 'tv-idle') {
      S.tvId = msg.tvId;
      S.tvName = msg.tvName;
      localStorage.setItem('tvgames-tv-id', S.tvId);
      S.state = null;
      S.room = '';
      renderIdle();
    } else if (msg.type === 'tv-paired') {
      S.tvId = msg.tvId;
      S.tvName = msg.tvName;
      S.room = msg.room;
      S.qr = msg.qrDataUrl || '';
      localStorage.setItem('tvgames-tv-id', S.tvId);
      roomCodeEl.textContent = S.room;
    } else if (msg.type === 'room-state') {
      S.state = msg;
      S.room = msg.room;
      roomCodeEl.textContent = S.room;
      render();
    }
  };
}

if (navigator.locks) {
  navigator.locks.request('tvgames-tv', { ifAvailable: true }, async (lock) => {
    if (!lock) {
      statusEl.textContent = 'TV déjà ouverte dans un autre onglet';
      statusEl.className = 'text-amber-400';
      return;
    }
    connect();
    await new Promise(() => {});
  });
} else {
  connect();
}
