import { S, UI, PALETTE, SYMBOLS, GAMES } from './state.js';
import { escapeHtml, playerNameOf, setLastError } from './utils.js';
import { hideOverlays, showPlay, navigate } from './router.js';

const gameName = (id) => (GAMES.find((g) => g.id === id) || {}).name || id;

export function renderEndModal() {
  const modal = document.getElementById('end-modal');
  const card = document.getElementById('end-modal-card');
  if (!modal || !card) return;
  const d = S.state?.duel;
  const over = S.state && S.state.game && S.state.game !== 'lobby' && S.state.started && d && (d.winnerId || d.isDraw);
  if (!over || !S.duelCache.data) { modal.classList.add('hidden'); modal.classList.remove('flex'); return; }
  const data = S.duelCache.data;
  const myId = S.myId;
  const isRed = myId === d.red, isYellow = myId === d.yellow;
  const first = (isRed || (!isRed && !isYellow)) ? d.red : d.yellow;
  const second = first === d.red ? d.yellow : d.red;
  const wFirst = first === d.red ? data.w1 : data.w2;
  const wSecond = first === d.red ? data.w2 : data.w1;
  let title;
  if (d.isDraw) title = '<p class="text-[6vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</p>';
  else if (d.winnerId === myId) title = '<p class="text-[6vmin] font-bold text-emerald-400"><i class="fa-solid fa-trophy"></i> Vous avez gagné !</p>';
  else if (isRed || isYellow) title = '<p class="text-[6vmin] font-bold text-red-400"><i class="fa-solid fa-face-frown"></i> Vous avez perdu</p>';
  else title = `<p class="text-[6vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${escapeHtml(playerNameOf(d.winnerId))} gagne !</p>`;
  card.innerHTML = `${title}
    <p class="mt-[2vmin] font-mono text-[14vmin] font-bold leading-none">${wFirst} - ${wSecond}</p>
    <p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">${escapeHtml(playerNameOf(first))} · ${escapeHtml(playerNameOf(second))} — ${escapeHtml(gameName(S.state.game))}${data.draws ? ` · ${data.draws} nul(s)` : ''}</p>
    <div class="mt-[3vmin] flex gap-2">
      ${S.state.hostId === myId ? '<button id="btn-rematch" class="flex-1 rounded-xl border border-amber-500 bg-amber-500 px-4 py-[2vmin] text-[4vmin] font-bold text-zinc-950"><i class="fa-solid fa-rotate-right"></i> Rejouer</button>' : ''}
      <button id="btn-end-menu" class="flex-1 rounded-xl border border-zinc-700 px-4 py-[2vmin] text-[4vmin] font-bold"><i class="fa-solid fa-house"></i> Menu</button>
    </div>`;
  modal.classList.remove('hidden'); modal.classList.add('flex');
  const rematch = document.getElementById('btn-rematch');
  if (rematch) rematch.onclick = () => { hideOverlays(); S.ws?.send(JSON.stringify({ type: 'rematch' })); };
  document.getElementById('btn-end-menu').onclick = () => {
    if (S.state.hostId === S.myId) S.ws?.send(JSON.stringify({ type: 'set-game', game: 'lobby' }));
    navigate('/controller/game');
  };
}

export function renderRematchModal() {
  const modal = document.getElementById('rematch-modal');
  const card = document.getElementById('rematch-modal-card');
  if (!modal || !card) return;
  const d = S.state?.duel;
  const show = S.joined && S.rematchOffer && S.state && S.rematchOffer.room === S.state.room
    && S.state.game && S.state.game !== 'lobby' && !S.state.started && d
    && S.myId !== S.state.hostId && (S.myId === d.red || S.myId === d.yellow);
  if (!show) { modal.classList.add('hidden'); modal.classList.remove('flex'); return; }
  card.innerHTML = `<p class="text-[5vmin] font-bold"><i class="fa-solid fa-rotate-right text-amber-300"></i> Revanche ?</p>
    <p class="mt-[2vmin] text-[4vmin]">${escapeHtml(S.rematchOffer.from)} propose de rejouer !</p>
    <div class="mt-[3vmin] flex gap-2">
      <button id="btn-rematch-yes" class="flex-1 rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-[2vmin] text-[4vmin] font-bold text-white"><i class="fa-solid fa-check"></i> Accepter</button>
      <button id="btn-rematch-no" class="flex-1 rounded-xl border border-zinc-700 px-4 py-[2vmin] text-[4vmin] font-bold"><i class="fa-solid fa-xmark"></i> Refuser</button>
    </div>`;
  modal.classList.remove('hidden'); modal.classList.add('flex');
  document.getElementById('btn-rematch-yes').onclick = () => { S.rematchOffer = null; S.ws?.send(JSON.stringify({ type: 'ready', ready: true })); };
  document.getElementById('btn-rematch-no').onclick = () => { S.rematchOffer = null; hideOverlays(); S.ws?.send(JSON.stringify({ type: 'rematch-decline' })); };
}

export function maybeFetchDuel(board) {
  const d = S.state?.duel;
  const over = S.state && S.state.game && S.state.game !== 'lobby' && S.state.started && d && (d.winnerId || d.isDraw);
  if (!over || !d.red || !d.yellow) {
    if (S.duelCache.key || S.duelCache.data) S.duelCache = { key: null, data: null };
    renderEndModal();
    return;
  }
  const key = `${S.state.room}:${S.state.game}:${d.winnerId || 'draw'}:${JSON.stringify(board || null)}`;
  if (key === S.duelCache.key) { renderEndModal(); return; }
  S.duelCache = { key, data: null };
  renderEndModal();
  fetch(`/api/duel?game=${encodeURIComponent(S.state.game)}&a=${encodeURIComponent(d.red)}&b=${encodeURIComponent(d.yellow)}`)
    .then((r) => r.json())
    .then((dd) => { if (S.duelCache.key === key) { S.duelCache.data = dd; renderEndModal(); } })
    .catch(() => {});
}

const UNO_BG = { r: 'bg-red-500', b: 'bg-blue-500', g: 'bg-green-500', y: 'bg-yellow-400' };
const UNO_NAME = { r: 'Rouge', b: 'Bleu', g: 'Vert', y: 'Jaune' };

function unoLabel(card) {
  if (!card) return '?';
  if (card.kind === 'num') return String(card.value);
  if (card.kind === 'block') return 'STOP';
  if (card.kind === '+2') return '+2';
  if (card.kind === 'reverse') return 'SENS';
  return '+4';
}

function preGameHtml(title, pickerHtml) {
  const state = S.state, myId = S.myId, d = state.duel;
  const isRed = myId === d.red, isYellow = myId === d.yellow;
  const contestant = isRed || isYellow;
  const isHost = state.hostId === myId;
  const readyMark = (id) => state.ready[id]
    ? '<i class="fa-solid fa-check text-emerald-400"></i>'
    : '<i class="fa-solid fa-hourglass-half text-zinc-500"></i>';
  const amReady = !!state.ready[myId];
  const bothReady = d.red && d.yellow && state.ready[d.red] && state.ready[d.yellow];
  return `${title}${d.red && d.yellow
    ? `<p class="text-[3.8vmin] font-bold">${escapeHtml(playerNameOf(d.red))} ${readyMark(d.red)} vs ${escapeHtml(playerNameOf(d.yellow))} ${readyMark(d.yellow)}</p>`
    : '<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">En attente d\u2019un adversaire…</p>'}
  ${contestant ? pickerHtml : '<p class="text-[3.2vmin] text-zinc-500">Tu regarderas la partie <i class="fa-solid fa-eye"></i></p>'}
  ${contestant ? `<button id="btn-ready" class="mt-[2vmin] w-full rounded-xl border px-4 py-[2vmin] text-[4vmin] font-bold ${amReady ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-zinc-700'}"><i class="fa-solid fa-check"></i> ${amReady ? 'Prêt ! (tap pour annuler)' : 'Je suis prêt !'}</button>` : ''}
  ${isHost ? `<button id="btn-start" ${bothReady ? '' : 'disabled'} class="mt-[1.5vmin] w-full rounded-xl border px-4 py-[2vmin] text-[4vmin] font-bold ${bothReady ? 'border-amber-500 bg-amber-500 text-zinc-950' : 'border-zinc-800 text-zinc-600'}"><i class="fa-solid fa-play"></i> Lancer la partie</button>
  ${bothReady ? '' : '<p class="mt-[1vmin] text-[3.4vmin] text-zinc-500">En attente que les 2 joueurs soient prêts…</p>'}` : '<p class="mt-[1vmin] text-[3.4vmin] text-zinc-400">Le gérant lancera la partie…</p>'}
  ${S.lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(S.lastError)}</p>` : ''}`;
}

export function renderControls() {
  if (!S.state) return;
  if (S.state.game === 'lobby') { navigate('/controller/game', true); return; }
  showPlay();
  const state = S.state;
  UI.gameLabel.textContent = gameName(state.game);
  const isHost = state.hostId === S.myId;
  const me = state.players.find((p) => p.id === S.myId) || {};
  const myBg = (PALETTE.find((c) => c.id === me.color) || {}).bg || 'bg-zinc-500';
  const takenBy = (id) => (state.players.find((p) => p.color === id && p.id !== S.myId) || {}).name;
  const colorHtml = `<p class="mt-[2vmin] text-[3.8vmin] font-bold">Ta couleur :</p>
    <div class="mt-[1vmin] grid w-full grid-cols-4 gap-[1.5vmin]">${
      PALETTE.map((c) => {
        const by = takenBy(c.id);
        return `<button data-color="${c.id}" ${by ? 'disabled' : ''} class="p4-color flex items-center justify-center gap-1 rounded-xl border px-1 py-[1.6vmin] text-[3vmin] ${c.id === me.color ? 'border-white ring-2 ring-white' : 'border-zinc-700'} ${by ? 'opacity-30' : ''}"><span class="h-[3.5vmin] w-[3.5vmin] rounded-full ${c.bg}"></span>${by ? escapeHtml(by) : c.name}</button>`;
      }).join('')
    }</div>`;
  document.getElementById('name-label').innerHTML =
    `${escapeHtml(sessionStorage.getItem('tvgames-player-name') || '')}${isHost ? ' <i class="fa-solid fa-crown text-amber-300"></i>' : ''} <span class="inline-block h-3 w-3 rounded-full ${myBg}"></span>`;

  let gameHtml = '';
  if (state.game === 'puissance4') {
    const c4 = state.connect4;
    const myId = S.myId;
    const isRed = myId === c4.red;
    const isYellow = myId === c4.yellow;
    const contestant = isRed || isYellow;
    const readyMark = (id) => state.ready[id]
      ? '<i class="fa-solid fa-check text-emerald-400"></i>'
      : '<i class="fa-solid fa-hourglass-half text-zinc-500"></i>';
    if (!state.started) {
      const amReady = !!state.ready[myId];
      const bothReady = c4.red && c4.yellow && state.ready[c4.red] && state.ready[c4.yellow];
      gameHtml = `${c4.red && c4.yellow
        ? `<p class="text-[3.8vmin] font-bold">${escapeHtml(playerNameOf(c4.red))} ${readyMark(c4.red)} vs ${escapeHtml(playerNameOf(c4.yellow))} ${readyMark(c4.yellow)}</p>`
        : '<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">En attente d\u2019un adversaire…</p>'}
      ${contestant ? colorHtml : '<p class="text-[3.2vmin] text-zinc-500">Tu regarderas la partie <i class="fa-solid fa-eye"></i></p>'}
      ${contestant ? `<button id="btn-ready" class="mt-[2vmin] w-full rounded-xl border px-4 py-[2vmin] text-[4vmin] font-bold ${amReady ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-zinc-700'}"><i class="fa-solid fa-check"></i> ${amReady ? 'Prêt ! (tap pour annuler)' : 'Je suis prêt !'}</button>` : ''}
      ${isHost ? `<button id="btn-start" ${bothReady ? '' : 'disabled'} class="mt-[1.5vmin] w-full rounded-xl border px-4 py-[2vmin] text-[4vmin] font-bold ${bothReady ? 'border-amber-500 bg-amber-500 text-zinc-950' : 'border-zinc-800 text-zinc-600'}"><i class="fa-solid fa-play"></i> Lancer la partie</button>
      ${bothReady ? '' : '<p class="mt-[1vmin] text-[3.4vmin] text-zinc-500">En attente que les 2 joueurs soient prêts…</p>'}` : '<p class="mt-[1vmin] text-[3.4vmin] text-zinc-400">Le gérant lancera la partie…</p>'}
      ${S.lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(S.lastError)}</p>` : ''}`;
    } else {
    const myTurn = c4.turn === myId && !c4.winnerId && !c4.isDraw;
    let fallingM = null;
    if (S.prevGridM) {
      for (let r = 0; r < 6 && !fallingM; r++) {
        for (let c = 0; c < 7; c++) {
          if ((S.prevGridM[r][c] === null || S.prevGridM[r][c] === undefined) && c4.grid[r][c] !== null && c4.grid[r][c] !== undefined) { fallingM = `${r},${c}`; break; }
        }
      }
    }
    S.prevGridM = c4.grid.map((rowArr) => [...rowArr]);
    const tokenClass = (v, r, c) => {
      const base = 'aspect-square rounded-full';
      if (v !== null && v !== undefined) return `${base} ${c4.colorBg[v] || 'bg-zinc-500'}`;
      return `${base} bg-zinc-800`;
    };
    const board = c4.grid.map((rowArr, r) =>
      rowArr.map((v, c) => fallingM === `${r},${c}`
        ? `<div class="${tokenClass(v, r, c)} c4-drop" style="--fall:-${(r + 1) * 100}%"></div>`
        : `<div class="${tokenClass(v, r, c)}"></div>`).join('')
    ).join('');
    const cols = myTurn
      ? `<div class="mt-[1vmin] grid w-[min(100%,52dvh)] grid-cols-7 gap-1">${
          [0, 1, 2, 3, 4, 5, 6].map((c) => `<button data-col="${c}" class="p4-col rounded-lg border py-[1.5vmin] text-[4vmin] font-bold ${S.pendingCol === c ? 'border-sky-400 bg-sky-600' : 'border-zinc-700 active:bg-sky-500'}"><i class="fa-solid fa-chevron-down"></i></button>`).join('')
        }</div>`
      : '';
    const status = c4.winnerId
      ? `<p class="mt-[1vmin] text-[4.5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${c4.winnerId === myId ? 'Tu as gagné !' : `${escapeHtml(playerNameOf(c4.winnerId))} gagne !`}</p>`
      : c4.isDraw
        ? `<p class="mt-[1vmin] text-[4.5vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</p>`
        : !(c4.red && c4.yellow)
          ? `<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">En attente d'un adversaire…</p>`
          : myTurn
            ? `<p class="mt-[1vmin] text-[3.8vmin] font-bold text-emerald-400">À toi <i class="fa-solid fa-circle" style="color:${isRed ? '#ef4444' : '#facc15'}"></i> — tap une colonne, re-tap pour valider !</p>`
            : `<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">Tour de ${escapeHtml(playerNameOf(c4.turn))}…</p>`;
    gameHtml = `${contestant && c4.red && c4.yellow ? `<p class="text-[3.2vmin] text-zinc-500"><i class="fa-solid fa-circle" style="color:#ef4444"></i> ${escapeHtml(playerNameOf(c4.red))} vs <i class="fa-solid fa-circle" style="color:#facc15"></i> ${escapeHtml(playerNameOf(c4.yellow))}</p>` : '<p class="text-[3.2vmin] text-zinc-500">Tu regardes la partie <i class="fa-solid fa-eye"></i></p>'}
      ${(isRed || isYellow) ? colorHtml : ''}
      ${S.lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(S.lastError)}</p>` : ''}
      <div class="grid w-[min(100%,52dvh)] grid-cols-7 gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2">${board}</div>
      ${cols}${status}`;
    }
  }
  else if (state.game === 'tictactoe') {
    const t = state.tictactoe;
    const myId = S.myId, d = state.duel;
    const me = state.players.find((p) => p.id === myId) || {};
    const pi = (id) => ((state.players.find((p) => p.id === id) || {}).icon || 'fa-solid fa-circle');
    const ptext = (id) => ({ 'bg-red-500': 'text-red-500', 'bg-yellow-400': 'text-yellow-400', 'bg-blue-500': 'text-blue-500', 'bg-green-500': 'text-green-500', 'bg-purple-500': 'text-purple-500', 'bg-orange-500': 'text-orange-500', 'bg-pink-500': 'text-pink-500', 'bg-cyan-400': 'text-cyan-400', 'bg-lime-400': 'text-lime-400', 'bg-teal-400': 'text-teal-400', 'bg-indigo-500': 'text-indigo-500', 'bg-amber-800': 'text-amber-500' }[((state.players.find((p) => p.id === id) || {}).bg || 'bg-zinc-600')] || 'text-zinc-500');
    const contestant = myId === d.red || myId === d.yellow;
    if (!state.started) {
      const takenByS = (id) => (state.players.find((p) => p.symbol === id && p.id !== myId) || {}).name;
      gameHtml = preGameHtml('', `${contestant ? colorHtml : ''}
        <p class="mt-[2vmin] text-[3.8vmin] font-bold">Ton symbole :</p>
        <div class="mt-[1vmin] grid w-full grid-cols-3 gap-[1.5vmin]">${
          SYMBOLS.map((s) => {
            const by = takenByS(s.id);
            return `<button data-symbol="${s.id}" ${by ? 'disabled' : ''} class="ttt-symbol flex flex-col items-center justify-center rounded-xl border px-1 py-[1.6vmin] ${s.id === me.symbol ? 'border-white ring-2 ring-white' : 'border-zinc-700'} ${by ? 'opacity-30' : ''}"><span class="text-[6vmin] leading-none"><i class="${s.icon}"></i></span><span class="text-[3vmin]">${by ? escapeHtml(by) : s.name}</span></button>`;
          }).join('')
        }</div>`);
    } else {
      const myTurn = t.turn === myId && !d.winnerId && !d.isDraw;
      const cells = t.grid.map((v, i) => v
        ? `<div class="flex aspect-square items-center justify-center rounded-xl bg-zinc-800 text-[8vmin] ${ptext(v)}${(t.winCells || []).includes(i) ? ' ring-4 ring-emerald-400' : ''}"><i class="${pi(v)}"></i></div>`
        : myTurn
          ? `<button data-cell="${i}" class="ttt-cell aspect-square rounded-xl bg-zinc-800 text-[6vmin] text-zinc-600">·</button>`
          : '<div class="aspect-square rounded-xl bg-zinc-800"></div>').join('');
      const status = d.winnerId
        ? `<p class="mt-[1vmin] text-[4.5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${d.winnerId === myId ? 'Tu as gagné !' : `${escapeHtml(playerNameOf(d.winnerId))} gagne !`}</p>`
        : d.isDraw
          ? '<p class="mt-[1vmin] text-[4.5vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</p>'
          : myTurn
            ? '<p class="mt-[1vmin] text-[3.8vmin] font-bold text-emerald-400">À toi — tap une case !</p>'
            : `<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">Tour de ${escapeHtml(playerNameOf(t.turn))}…</p>`;
      gameHtml = `<p class="text-[3.2vmin] text-zinc-500">${escapeHtml(playerNameOf(d.red))} <span class="${ptext(d.red)}"><i class="${pi(d.red)}"></i></span> vs <span class="${ptext(d.yellow)}"><i class="${pi(d.yellow)}"></i></span> ${escapeHtml(playerNameOf(d.yellow))}</p>
        ${S.lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(S.lastError)}</p>` : ''}
        <div class="mt-[1vmin] grid w-[min(100%,52dvh)] grid-cols-3 gap-2">${cells}</div>${status}`;
    }
  }
  else if (state.game === 'memory') {
    const m = state.memory;
    const myId = S.myId, d = state.duel;
    if (!state.started) {
      S.prevFacesMM = null;
      gameHtml = preGameHtml('', '');
    } else {
      const myTurn = m.turn === myId && !d.winnerId && !d.isDraw;
      const cards = (m.faces || []).map((f, i) => {
        const fresh = f && !(S.prevFacesMM || [])[i] && !m.matched[i];
        const concealed = !f && (S.prevFacesMM || [])[i] && !m.matched[i];
        if (m.matched[i]) {
          const sb = ((state.players.find((p) => p.id === m.matched[i]) || {}).bg || 'bg-zinc-500');
          return `<div class="flex aspect-square items-center justify-center rounded-xl text-[6.5vmin] font-black text-white opacity-60 ${sb}">${escapeHtml(f || '')}</div>`;
        }
        if (f) return `<div class="flex aspect-square items-center justify-center rounded-xl bg-sky-700 text-[6.5vmin] font-black text-white${fresh ? ' memo-flip' : ''}">${escapeHtml(f)}</div>`;
        return myTurn
          ? `<button data-flip="${i}" class="mem-card aspect-square rounded-xl bg-zinc-800 text-[4vmin] text-zinc-600${concealed ? ' memo-unflip' : ''}">?</button>`
          : `<div class="flex aspect-square items-center justify-center rounded-xl bg-zinc-800 text-[4vmin] text-zinc-600${concealed ? ' memo-unflip' : ''}">?</div>`;
      }).join('');
      S.prevFacesMM = m.faces || [];
      const sc = (id) => (m.scores || {})[id] || 0;
      const status = d.winnerId
        ? `<p class="mt-[1vmin] text-[4.5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${d.winnerId === myId ? 'Tu as gagné !' : `${escapeHtml(playerNameOf(d.winnerId))} gagne !`}</p>`
        : d.isDraw
          ? '<p class="mt-[1vmin] text-[4.5vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</p>'
          : myTurn
            ? '<p class="mt-[1vmin] text-[3.8vmin] font-bold text-emerald-400">À toi — retourne 2 cartes !</p>'
            : `<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">Tour de ${escapeHtml(playerNameOf(m.turn))}…</p>`;
      gameHtml = `<p class="text-[3.4vmin] font-bold">${escapeHtml(playerNameOf(d.red))} ${sc(d.red)} — ${sc(d.yellow)} ${escapeHtml(playerNameOf(d.yellow))}</p>
        ${S.lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(S.lastError)}</p>` : ''}
        <div class="mt-[1vmin] grid w-[min(100%,52dvh)] grid-cols-4 gap-1.5">${cards}</div>${status}`;
    }
  }
  else if (state.game === 'bataille') {
    const b = state.bataille || {};
    const myId = S.myId, d = state.duel;
    const foe = myId === d.red ? d.yellow : d.red;
    if (!state.started) {
      S.lastFire = null; S.fireFlash = null; clearTimeout(S.fireFlashTimer);
      const key = state.room + ':bataille';
      if (S.batKey !== key) {
        S.batKey = key; S.batSel = 0; S.batHoriz = true; S.batActive = null;
        S.batShips = [null, null, null, null, null];
        const F0 = [5, 4, 3, 2, 2];
        const groups = (((b.fleets || {})[myId] || []).slice());
        F0.forEach((len, k) => {
          const gi = groups.findIndex((g) => g.length === len);
          if (gi >= 0) S.batShips[k] = groups.splice(gi, 1)[0].slice();
        });
      }
      const FLEET = [5, 4, 3, 2, 2];
      const OUT = ['outline-red-400', 'outline-emerald-400', 'outline-sky-400', 'outline-amber-400', 'outline-fuchsia-400'];
      const flat = S.batShips.filter(Boolean).flat();
      const mine = new Set(flat);
      const bIdx = {};
      S.batShips.forEach((f, k) => (f || []).forEach((i) => { bIdx[i] = k; }));
      if (S.batActive == null || !S.batShips[S.batActive]) S.batActive = null;
      const actBar = S.batActive == null ? '' : `<div class="mt-[1vmin] flex gap-1.5">
          <button data-batrot class="flex-1 rounded-lg border border-amber-500 bg-amber-500 px-2 py-1 text-[3.4vmin] font-bold text-zinc-950"><i class="fa-solid fa-rotate-right"></i> Pivoter</button>
          <button data-batdel class="flex-1 rounded-lg border border-red-800 px-2 py-1 text-[3.4vmin] font-bold text-red-400"><i class="fa-solid fa-trash"></i> Supprimer</button>
        </div>`;
      const selBtns = FLEET.map((len, k) => `<button data-batsel="${k}" class="rounded-lg border px-2 py-1 text-[3.4vmin] font-bold ${S.batSel === k ? 'border-sky-400 bg-sky-950' : 'border-zinc-700'}">${len} ${S.batShips[k] ? '<i class="fa-solid fa-check text-emerald-400"></i>' : ''}</button>`).join('');
      const ROWS = 'ABCDEFGHI';
      const mh = (t) => `<div class="flex aspect-square items-center justify-center text-[2.2vmin] font-bold text-zinc-500">${t}</div>`;
      const mini = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(mh).join('')
        + Array.from({ length: 9 }, (_, r) => mh(ROWS[r])
          + Array.from({ length: 9 }, (_, c) => {
            const i = r * 9 + c;
            const sel = bIdx[i] === S.batActive && S.batActive != null;
            return `<button data-bat="${i}"${sel ? ' style="box-shadow:0 0 0 2px #fff"' : ''} class="aspect-square rounded-[2px] ${mine.has(i) ? `bg-zinc-700 outline outline-2 ${OUT[(bIdx[i] ?? 0) % 5]}` : 'bg-blue-950'}"></button>`;
          }).join('')).join('');
      gameHtml = preGameHtml('', `<p class="mt-[2vmin] text-[3.8vmin] font-bold">Place tes bateaux (${flat.length}/16) :</p>
        <div class="mt-[1vmin] flex gap-1.5">${selBtns}</div>
        <button data-batrandom class="mt-[1vmin] w-full rounded-lg border border-zinc-700 px-2 py-1 text-[3.4vmin] font-bold"><i class="fa-solid fa-dice"></i> Aléatoire</button>
        ${actBar}
        <p class="mt-[1vmin] text-[3vmin] text-zinc-400">Tap une case pour poser, glisse un bateau pour le déplacer, tap un bateau pour pivoter / supprimer.</p>
        <div id="bat-place" style="touch-action:none;user-select:none" class="mt-[1vmin] grid w-[min(100%,44dvh)] grid-cols-10 gap-[2px] rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">${mini}</div>`);
    } else {
      const myShots = ((b.shots || {})[myId] || {});
      const foeShots = ((b.shots || {})[foe] || {});
      const myTurn = b.turn === myId && !d.winnerId;
      let flash = '';
      const nowTs = Date.now();
      if (S.lastFire) {
        const cur = myShots[S.lastFire.cell];
        if (cur !== undefined && cur !== S.lastFire.prev) {
          clearTimeout(S.fireFlashTimer);
          S.fireFlash = { cell: S.lastFire.cell, result: cur, until: nowTs + 3000 };
          S.fireFlashTimer = setTimeout(() => {
            S.fireFlash = null;
            if (S.state?.game === 'bataille' && S.state?.started) { try { renderControls(); } catch {} }
          }, 3050);
        }
        if (cur !== undefined) S.lastFire = null;
      }
      let ff = null;
      if (S.fireFlash && nowTs < S.fireFlash.until) ff = S.fireFlash;
      else S.fireFlash = null;
      if (ff) {
        const hit = ff.result === 'hit';
        flash = `<p class="mt-[1vmin] rounded-xl border px-4 py-[1vmin] text-[4vmin] font-black ${hit ? 'border-emerald-500 bg-emerald-950 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}">${hit ? '<i class="fa-solid fa-crosshairs"></i> Touché !' : '<i class="fa-solid fa-water"></i> Loupé…'}</p>`;
      }
      const ROWS = 'ABCDEFGHI';
      const eh = (t) => `<div class="flex aspect-square items-center justify-center text-[3vmin] font-bold text-zinc-500">${t}</div>`;
      const enemy = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(eh).join('')
        + Array.from({ length: 9 }, (_, r) => eh(ROWS[r]) + Array.from({ length: 9 }, (_, c) => {
          const i = r * 9 + c;
          const fl = ff && ff.cell === i ? ' outline outline-2 outline-white' : '';
          if (myShots[i] === 'hit') return `<div class="flex aspect-square items-center justify-center rounded bg-red-500 text-[3.4vmin] font-black text-white${fl}">X</div>`;
          if (myShots[i] === 'miss') return `<div class="flex aspect-square items-center justify-center rounded bg-blue-900 text-[3.4vmin] text-blue-300${fl}">·</div>`;
          return myTurn
            ? `<button data-fire="${i}" class="bat-cell aspect-square rounded bg-blue-950 text-[3vmin] text-blue-800">·</button>`
            : '<div class="aspect-square rounded bg-blue-950"></div>';
        }).join('')).join('');
      const mine = new Set(((b.ships || {})[myId] || []));
      const OUT = ['outline-red-400', 'outline-emerald-400', 'outline-sky-400', 'outline-amber-400', 'outline-fuchsia-400'];
      const bIdx = {};
      (((b.fleets || {})[myId] || []).forEach((f, k) => f.forEach((i) => { bIdx[i] = k; })));
      const mh2 = (t) => `<div class="flex aspect-square items-center justify-center text-[2.2vmin] font-bold text-zinc-500">${t}</div>`;
      const myBoard = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(mh2).join('')
        + Array.from({ length: 9 }, (_, r) => mh2(ROWS[r]) + Array.from({ length: 9 }, (_, c) => {
          const i = r * 9 + c;
          if (foeShots[i] === 'hit') return '<div class="aspect-square rounded-[2px] bg-red-500"></div>';
          if (foeShots[i] === 'miss') return '<div class="aspect-square rounded-[2px] bg-blue-900"></div>';
          return `<div class="aspect-square rounded-[2px] ${mine.has(i) ? `bg-zinc-700 outline outline-2 ${OUT[(bIdx[i] ?? 0) % 5]}` : 'bg-blue-950'}"></div>`;
        }).join('')).join('');
      const status = d.winnerId
        ? `<p class="mt-[1vmin] text-[4.5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${d.winnerId === myId ? 'Tu as gagné !' : `${escapeHtml(playerNameOf(d.winnerId))} gagne !`}</p>`
        : myTurn
          ? '<p class="mt-[1vmin] text-[3.8vmin] font-bold text-emerald-400">À toi — choisis une case !</p>'
          : `<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">Tir de ${escapeHtml(playerNameOf(b.turn))}…</p>`;
      gameHtml = `<p class="text-[3.4vmin] font-bold">Ta flotte :</p>
        <div class="mt-[1vmin] grid w-[min(60%,30dvh)] grid-cols-10 gap-[2px] rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">${myBoard}</div>
        <p class="mt-[2vmin] text-[3.4vmin] font-bold">Tirs sur ${escapeHtml(playerNameOf(foe))}</p>${flash}
        ${S.lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(S.lastError)}</p>` : ''}
        <div class="mt-[1vmin] grid w-[min(100%,52dvh)] grid-cols-10 gap-1">${enemy}</div>${status}`;
    }
  }
  else if (state.game === 'uno') {
    const u = state.uno || {};
    const myId = S.myId, d = state.duel;
    if (!state.started) {
      gameHtml = preGameHtml('', '');
    } else {
      const hand = ((u.hands || {})[myId] || []);
      const myTurn = u.turn === myId && !d.winnerId;
      const wildPick = u.pendingWild === myId;
      const order = { r: 0, b: 1, g: 2, y: 3 };
      const sorted = [...hand].sort((a, b2) => (order[a.color] ?? 9) - (order[b2.color] ?? 9) || String(a.kind).localeCompare(String(b2.kind)) || (a.value ?? 0) - (b2.value ?? 0));
      const cardHtml = (c, btn) => {
        const bg = c.kind === '+4' ? 'bg-zinc-950 border-2 border-white' : (UNO_BG[c.color] || 'bg-zinc-700');
        const face = c.kind === 'reverse' ? '<i class="fa-solid fa-arrows-rotate"></i>' : unoLabel(c);
        const inner = `<div class="relative flex h-[26vmin] w-[19vmin] shrink-0 items-center justify-center rounded-xl font-black text-white shadow-lg ${bg} ${c.kind === 'num' || c.kind === '+2' || c.kind === '+4' ? 'text-[7vmin]' : 'text-[5vmin]'}"><span class="absolute left-[1.5vmin] top-[1vmin] text-[3.8vmin] leading-none">${face}</span>${face}</div>`;
        return btn ? `<button data-card="${c.id}" class="uno-card rounded-xl active:scale-95">${inner}</button>` : inner;
      };
      const counts = u.counts || {};
      const status = d.winnerId
        ? `<p class="mt-[1vmin] text-[4.5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${d.winnerId === myId ? 'Tu as gagné !' : `${escapeHtml(playerNameOf(d.winnerId))} gagne !`}</p>`
        : wildPick
          ? '<p class="mt-[1vmin] text-[3.8vmin] font-bold text-emerald-400">+4 ! Choisis une couleur :</p>'
          : myTurn
            ? '<p class="mt-[1vmin] text-[3.8vmin] font-bold text-emerald-400">À toi — joue, pioche ou passe !</p>'
            : `<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">Tour de ${escapeHtml(playerNameOf(u.turn))}…</p>`;
      gameHtml = `<div class="flex items-center gap-[3vmin]">
          <div class="text-center"><p class="text-[3vmin] text-zinc-500">Défausse</p>${cardHtml(u.top, false)}</div>
          <div class="text-center"><p class="text-[3vmin] text-zinc-500">Couleur</p><div class="mx-auto h-[8vmin] w-[8vmin] rounded-full ${u.color ? UNO_BG[u.color] : 'bg-zinc-700'}"></div>
          <p class="text-[3vmin] text-zinc-400">${u.color ? UNO_NAME[u.color] : '…'}</p></div>
        </div>
        <p class="mt-[1vmin] text-[3.2vmin] text-zinc-400">${escapeHtml(playerNameOf(d.red))} : ${counts[d.red] ?? '?'} · ${escapeHtml(playerNameOf(d.yellow))} : ${counts[d.yellow] ?? '?'}</p>
        ${S.lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(S.lastError)}</p>` : ''}
        ${wildPick ? `<div class="mt-[1vmin] grid w-full grid-cols-4 gap-2">${Object.entries(UNO_BG).map(([id, bg]) => `<button data-color="${id}" class="uno-color h-[9vmin] rounded-xl ${bg} text-[3.4vmin] font-bold text-white">${UNO_NAME[id]}</button>`).join('')}</div>` : ''}
        <div class="mt-[1vmin] flex max-w-full flex-wrap items-center justify-center gap-2 overflow-y-auto">${sorted.map((c) => cardHtml(c, myTurn && !wildPick)).join('')}</div>
        ${hand.some((c) => c.kind === '+4') && !wildPick ? '<p class="mt-[1vmin] text-center text-[3vmin] text-zinc-500"><span class="font-bold text-zinc-300">+4</span> : se pose sur tout, +4 cartes adverses, puis tu choisis la couleur.</p>' : ''}
        ${myTurn && !wildPick ? '<div class="mt-[2vmin] flex w-full gap-2"><button id="btn-uno-draw" class="flex-1 rounded-xl border border-zinc-700 px-4 py-[2vmin] text-[4vmin] font-bold"><i class="fa-solid fa-plus"></i> Piocher</button><button id="btn-uno-pass" class="flex-1 rounded-xl border border-zinc-700 px-4 py-[2vmin] text-[4vmin] font-bold text-zinc-400"><i class="fa-solid fa-forward"></i> Passer</button></div>' : ''}
        ${status}`;
    }
  }

  const fd = state.duel;
  if (state.game !== 'lobby' && state.started && !fd.winnerId && !fd.isDraw && (S.myId === fd.red || S.myId === fd.yellow)) {
    gameHtml += `<button id="btn-forfeit" class="mt-[2vmin] w-full rounded-xl border border-red-800 px-4 py-[2vmin] text-[4vmin] font-bold text-red-400"><i class="fa-solid fa-flag"></i> Abandonner</button>`;
  }

  UI.controlsEl.innerHTML = gameHtml;  maybeFetchDuel(S.state.started ? S.state[S.state.game] : null);
  renderRematchModal();
  const readyBtn = document.getElementById('btn-ready');
  if (readyBtn) readyBtn.onclick = () => S.ws?.send(JSON.stringify({ type: 'ready', ready: !state.ready[S.myId] }));
  const startBtn = document.getElementById('btn-start');
  if (startBtn) startBtn.onclick = () => S.ws?.send(JSON.stringify({ type: 'start-game' }));
  UI.controlsEl.querySelectorAll('.p4-col').forEach((b) => {
    b.onclick = () => {
      const col = Number(b.dataset.col);
      if (S.pendingCol === col) {
        S.pendingCol = null;
        S.ws?.send(JSON.stringify({ type: 'input', action: 'drop', col }));
      } else {
        S.pendingCol = col;
        renderControls();
      }
    };
  });
  UI.controlsEl.querySelectorAll('.p4-color').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'set-color', color: b.dataset.color }));
  });
  UI.controlsEl.querySelectorAll('.ttt-cell').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'input', action: 'cell', col: Number(b.dataset.cell) }));
  });
  UI.controlsEl.querySelectorAll('.ttt-symbol').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'set-symbol', symbol: b.dataset.symbol }));
  });
  UI.controlsEl.querySelectorAll('.mem-card').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'input', action: 'flip', col: Number(b.dataset.flip) }));
  });
  UI.controlsEl.querySelectorAll('.bat-cell').forEach((b) => {
    b.onclick = () => {
      const idx = Number(b.dataset.fire);
      const prev = ((((S.state || {}).bataille || {}).shots || {})[S.myId] || {})[idx];
      S.lastFire = { cell: idx, prev };
      S.ws?.send(JSON.stringify({ type: 'input', action: 'fire', col: idx }));
    };
  });
  UI.controlsEl.querySelectorAll('[data-batsel]').forEach((b) => {
    b.onclick = () => { S.batSel = Number(b.dataset.batsel); renderControls(); };
  });
  UI.controlsEl.querySelectorAll('[data-bat]').forEach((b) => {
    b.onclick = () => {
      if (S.batDragged && Date.now() - S.batDragged < 500) return;
      const i = Number(b.dataset.bat);
      const FLEET = [5, 4, 3, 2, 2];
      const len = FLEET[S.batSel ?? 0];
      const mine = new Set(S.batShips.filter(Boolean).flat());
      const bIdx = {};
      S.batShips.forEach((f, k) => (f || []).forEach((x) => { bIdx[x] = k; }));
      if (bIdx[i] !== undefined) {
        const k = bIdx[i];
        S.batActive = S.batActive === k ? null : k;
        S.batAnchor = i;
      } else {
        const r = Math.floor(i / 9), c = i % 9;
        const cells = [];
        for (let k = 0; k < len; k++) {
          const rr = S.batHoriz ? r : r + k, cc = S.batHoriz ? c + k : c;
          if (rr > 8 || cc > 8) { setLastError('hors grille'); renderControls(); return; }
          cells.push(rr * 9 + cc);
        }
        const old = new Set(S.batShips[S.batSel] || []);
        if (cells.some((x) => mine.has(x) && !old.has(x))) { setLastError('chevauchement'); renderControls(); return; }
        S.batShips[S.batSel] = cells;
        S.batActive = S.batSel;
        S.batAnchor = cells[0];
      }
      S.ws?.send(JSON.stringify({ type: 'place-ships', cells: S.batShips.filter(Boolean).flat() }));
      renderControls();
    };
  });
  const rndBtn = UI.controlsEl.querySelector('[data-batrandom]');
  if (rndBtn) rndBtn.onclick = () => {
    const taken = new Set();
    const groups = [];
    const neigh = (x) => {
      const r = Math.floor(x / 9), c = x % 9, out = [x];
      if (r > 0) out.push(x - 9);
      if (r < 8) out.push(x + 9);
      if (c > 0) out.push(x - 1);
      if (c < 8) out.push(x + 1);
      return out;
    };
    for (const len of [5, 4, 3, 2, 2]) {
      for (let t = 0; t < 300 && groups.length < 5; t++) {
        const horiz = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (horiz ? 9 : 9 - len + 1));
        const c = Math.floor(Math.random() * (horiz ? 9 - len + 1 : 9));
        const cells = Array.from({ length: len }, (_, k) => (horiz ? r * 9 + c + k : (r + k) * 9 + c));
        if (cells.every((x) => neigh(x).every((n) => !taken.has(n)))) {
          cells.forEach((x) => taken.add(x));
          groups.push(cells);
          break;
        }
      }
    }
    if (groups.length !== 5) { setLastError('tirage impossible, réessaie'); renderControls(); return; }
    S.batShips = groups;
    S.batActive = null;
    S.ws?.send(JSON.stringify({ type: 'place-ships', cells: groups.flat() }));
    renderControls();
  };
  const rotBtn = UI.controlsEl.querySelector('[data-batrot]');
  if (rotBtn) rotBtn.onclick = () => {
    const k = S.batActive;
    const ship = (S.batShips[k] || []).slice();
    if (ship.length < 2) return;
    const anchor = ship.includes(S.batAnchor) ? S.batAnchor : ship[0];
    const horiz = ship.every((x) => Math.floor(x / 9) === Math.floor(ship[0] / 9));
    const sorted = ship.slice().sort((a, b2) => (horiz ? (a % 9) - (b2 % 9) : Math.floor(a / 9) - Math.floor(b2 / 9)));
    const j0 = Math.max(0, sorted.indexOf(anchor));
    const ar = Math.floor(anchor / 9), ac = anchor % 9;
    const others = new Set(S.batShips.filter((_, x) => x !== k).filter(Boolean).flat());
    const order = [j0];
    for (let dd = 1; dd < sorted.length; dd++) {
      if (j0 - dd >= 0) order.push(j0 - dd);
      if (j0 + dd < sorted.length) order.push(j0 + dd);
    }
    for (const p of order) {
      const cells = [];
      let ok = true;
      for (let t = 0; t < sorted.length; t++) {
        const rr = horiz ? ar - p + t : ar, cc = horiz ? ac : ac - p + t;
        if (rr < 0 || rr > 8 || cc < 0 || cc > 8 || others.has(rr * 9 + cc)) { ok = false; break; }
        cells.push(rr * 9 + cc);
      }
      if (ok) {
        S.batShips[k] = cells;
        S.batAnchor = anchor;
        S.ws?.send(JSON.stringify({ type: 'place-ships', cells: S.batShips.filter(Boolean).flat() }));
        renderControls();
        return;
      }
    }
    setLastError('rotation impossible'); renderControls();
  };
  const delBtn = UI.controlsEl.querySelector('[data-batdel]');
  if (delBtn) delBtn.onclick = () => {
    S.batShips[S.batActive] = null;
    S.batActive = null;
    S.ws?.send(JSON.stringify({ type: 'place-ships', cells: S.batShips.filter(Boolean).flat() }));
    renderControls();
  };
  const bpGrid = document.getElementById('bat-place');
  if (bpGrid) {
    let drag = null;
    const othersOf = (k) => new Set(S.batShips.filter((_, x) => x !== k).filter(Boolean).flat());
    const paint = (cells, ok) => {
      bpGrid.querySelectorAll('[data-bat]').forEach((c) => { c.style.outlineColor = ''; c.style.outlineWidth = ''; });
      (cells || []).forEach((x) => {
        const c = bpGrid.querySelector(`[data-bat="${x}"]`);
        if (c) { c.style.outlineWidth = '2px'; c.style.outlineColor = ok ? '#10b981' : '#ef4444'; }
      });
    };
    bpGrid.querySelectorAll('[data-bat]').forEach((cell) => {
      cell.addEventListener('pointerdown', (e) => {
        const i = Number(cell.dataset.bat);
        const kk = (S.batShips || []).findIndex((f) => (f || []).includes(i));
        if (kk < 0) return;
        e.preventDefault();
        try { bpGrid.setPointerCapture(e.pointerId); } catch {}
        drag = { k: kk, ship: S.batShips[kk].slice(), start: i, anchor: null, ok: false, key: '' };
      });
    });
    bpGrid.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-bat]');
      if (!t) return;
      const i = Number(t.dataset.bat);
      const dr = Math.floor(i / 9) - Math.floor(drag.start / 9);
      const dc = (i % 9) - (drag.start % 9);
      const key = `${dr},${dc}`;
      if (key === drag.key) return;
      drag.key = key;
      if (!dr && !dc) { drag.anchor = null; paint(null); return; }
      const cells = drag.ship.map((x) => {
        const rr = Math.floor(x / 9) + dr, cc = (x % 9) + dc;
        return (rr < 0 || rr > 8 || cc < 0 || cc > 8) ? -1 : rr * 9 + cc;
      });
      const others = othersOf(drag.k);
      drag.ok = !cells.includes(-1) && !cells.some((x) => others.has(x));
      drag.anchor = cells.includes(-1) ? null : cells;
      paint(drag.anchor, drag.ok);
    });
    const endDrag = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      paint(null);
      if (!d.anchor) return;
      S.batDragged = Date.now();
      if (!d.ok) { setLastError('déplacement impossible'); renderControls(); return; }
      S.batShips[d.k] = d.anchor;
      S.batActive = d.k;
      S.batAnchor = d.anchor[0];
      S.ws?.send(JSON.stringify({ type: 'place-ships', cells: S.batShips.filter(Boolean).flat() }));
      renderControls();
    };
    bpGrid.addEventListener('pointerup', endDrag);
    bpGrid.addEventListener('pointercancel', () => { drag = null; paint(null); });
  }
  UI.controlsEl.querySelectorAll('.uno-card').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'input', action: 'play', col: b.dataset.card }));
  });
  const drBtn = document.getElementById('btn-uno-draw');
  if (drBtn) drBtn.onclick = () => S.ws?.send(JSON.stringify({ type: 'input', action: 'draw' }));
  const psBtn = document.getElementById('btn-uno-pass');
  if (psBtn) psBtn.onclick = () => S.ws?.send(JSON.stringify({ type: 'input', action: 'pass' }));
  UI.controlsEl.querySelectorAll('.uno-color').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'input', action: 'color', col: b.dataset.color }));
  });
  const ffBtn = document.getElementById('btn-forfeit');
  if (ffBtn) {
    let armed = false;
    let timer = null;
    ffBtn.onclick = () => {
      if (!armed) {
        armed = true;
        ffBtn.dataset.label = ffBtn.innerHTML;
        ffBtn.innerHTML = 'Sûr ? Re-tap pour abandonner';
        ffBtn.classList.add('bg-red-950');
        timer = setTimeout(() => {
          armed = false;
          ffBtn.innerHTML = ffBtn.dataset.label || 'Abandonner';
          ffBtn.classList.remove('bg-red-950');
        }, 3000);
        return;
      }
      clearTimeout(timer);
      S.ws?.send(JSON.stringify({ type: 'forfeit' }));
    };
  }
}
