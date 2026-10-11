import { S, GAMES } from './state.js';
import { escapeHtml } from './utils.js';
import { showLobby } from './router.js';

let catalogCache = null;

export function renderLobby() {
  if (!S.state) return;
  showLobby();
  const state = S.state;
  if (!S.catalogCache) {
    S.catalogCache = GAMES;
    fetch('/api/games').then((r) => (r.ok ? r.json() : null)).then((cats) => {
      if (Array.isArray(cats) && cats.length && JSON.stringify(cats) !== JSON.stringify(S.catalogCache)) {
        S.catalogCache = cats;
        if (S.joined && location.pathname.replace(/\/+$/, '') === '/controller/game') renderLobby();
      }
    }).catch(() => {});
  }
  const catalog = S.catalogCache;
  const isHost = state.hostId === S.myId;
  const isCreator = state.creatorId === S.myId;
  const hostName = (state.players.find((p) => p.id === state.hostId) || {}).name || '—';
  const box = document.getElementById('lobby-content');

  let tvHtml = '';
  if (isCreator && !state.pairedTv) {
    tvHtml = `<div class="rounded-2xl border border-sky-700/60 bg-sky-950/30 px-3 py-2">
        <p class="font-bold text-sky-300"><i class="fa-solid fa-tv"></i> Étape 1 — choisis la TV</p>
        <p class="mt-1 text-sm text-zinc-400">Obligatoire : le salon ne démarre que sur une TV.</p>
        ${S.tvsIdle.length
          ? `<div class="mt-2 grid grid-cols-2 gap-2">${S.tvsIdle.map((t) => `<button data-tv="${t.tvId}" class="pick-tv rounded-xl border border-zinc-700 px-2 py-2 font-bold"><i class="fa-solid fa-tv"></i> ${escapeHtml(t.name)}</button>`).join('')}</div>`
          : `<p class="mt-1 text-sm text-zinc-400">Aucune TV en attente — ouvre /tv sur la TV.</p>`}
      </div>`;
  } else {
    tvHtml = `<p class="text-sm text-zinc-400"><i class="fa-solid fa-tv"></i> TV : ${state.pairedTv ? `<strong class="text-zinc-200">${escapeHtml(state.pairedTv.name)}</strong>` : 'en attente…'}</p>`;
  }

  const playersHtml = `<div class="flex flex-wrap gap-1">${state.players.map((p) => `<span class="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-xs"><span class="inline-block h-2 w-2 rounded-full ${p.bg || 'bg-zinc-500'}"></span>${escapeHtml(p.name)}${p.id === state.hostId ? ' <i class="fa-solid fa-crown text-amber-300"></i>' : ''}</span>`).join('')}</div>`;

  const picks = state.picks || {};
  const myPick = picks[S.myId];
  const nameOf = (id) => (state.players.find((p) => p.id === id) || {}).name || '?';
  const picksByGame = {};
  Object.entries(picks).forEach(([pid, gid]) => { (picksByGame[gid] = picksByGame[gid] || []).push(nameOf(pid)); });
  const topCount = Math.max(0, ...Object.values(picksByGame).map((a) => a.length));

  const cards = catalog.filter((g) => g.id !== 'lobby').map((g) => {
    const sel = g.id === state.game;
    const fans = picksByGame[g.id] || [];
    const mine = myPick === g.id;
    const hot = fans.length > 0 && fans.length === topCount && !sel;
    const inner = `<span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${sel ? 'bg-sky-500 text-zinc-950' : mine ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}"><i class="${g.icon} text-xl"></i></span>
        <span class="flex-1"><span class="font-bold">${escapeHtml(g.name)}${g.players ? `<span class="text-[11px] font-normal text-zinc-500"> · ${escapeHtml(g.players)}</span>` : ''}${mine ? ' <span class="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-zinc-950">ma proposition</span>' : ''}${hot ? ' <span class="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-zinc-950">populaire</span>' : ''}</span>
        <span class="block text-xs text-zinc-400">${escapeHtml(g.description || '')}</span>${fans.length ? `<span class="block text-[11px] text-zinc-500"><i class="fa-solid fa-thumbs-up"></i> ${fans.length} · ${escapeHtml(fans.slice(0, 2).join(', '))}${fans.length > 2 ? '…' : ''}</span>` : ''}</span>
        ${fans.length ? `<span class="rounded-full ${hot ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'} px-2 py-0.5 text-[11px] font-bold"><i class="fa-solid fa-thumbs-up"></i> ${fans.length}</span>` : ''}`;
    const frame = sel
      ? 'border-sky-500 bg-sky-950/40'
      : mine ? 'border-emerald-500 bg-emerald-950/40'
      : hot ? 'border-amber-400'
      : 'border-zinc-700';
    const locked = isHost && !state.pairedTv;
    const clickable = !locked && ((isHost && !sel) || !isHost);
    const action = isHost ? 'data-pick-game' : 'data-suggest-game';
    return clickable
      ? `<button ${action}="${g.id}" class="flex w-full items-center gap-2 rounded-xl border-2 ${frame} px-3 py-2 text-left active:bg-zinc-800">${inner}</button>`
      : `<div class="flex w-full items-center gap-2 rounded-xl border-2 ${frame} px-3 py-2">${inner}</div>`;
  }).join('');

  let gamesHtml = '';
  if (isHost && state.pairedTv) {
    gamesHtml = `<div class="rounded-2xl border border-amber-700/60 bg-amber-950/30 px-3 py-2">
        <p class="font-bold text-amber-300"><i class="fa-solid fa-crown"></i> Étape 2 — choisir le jeu</p>
        ${topCount ? `<p class="mt-0.5 text-xs text-zinc-400">Les joueurs proposent — à toi de trancher.</p>` : ''}
        <div class="mt-2 space-y-2">${cards}</div>
        <div class="mt-2 flex gap-2">
          <button id="btn-reset" class="flex-1 rounded-xl border border-amber-700/60 px-2 py-2 text-sm font-medium text-amber-300"><i class="fa-solid fa-rotate-right"></i> Nouvelle manche</button>
          ${state.game !== 'lobby' ? '<button id="btn-tolobby" class="flex-1 rounded-xl border border-zinc-700 px-2 py-2 text-sm text-zinc-400">Retour lobby</button>' : ''}
        </div>
      </div>`;
  } else {
    gamesHtml = `<div class="rounded-2xl border border-zinc-800 px-3 py-2">
        <p class="font-bold text-zinc-200"><i class="fa-solid fa-thumbs-up"></i> ${!state.pairedTv ? 'En attente de la TV…' : state.game === 'lobby' ? `Propose un jeu à ${escapeHtml(hostName)} :` : `Jeu en cours : <strong>${escapeHtml((catalog.find((g) => g.id === state.game) || {}).name || state.game)}</strong> — propose la suite :`}</p>
        <div class="mt-2 space-y-2">${cards}</div>
      </div>`;
  }

  const enterHtml = state.game !== 'lobby'
    ? `<button data-nav="/controller/game/${state.game}" class="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white"><i class="fa-solid fa-play"></i> Entrer dans le jeu</button>`
    : '';

  box.innerHTML = `<p class="text-center font-mono text-5xl font-bold tracking-widest text-sky-400">${state.room}</p>
    ${tvHtml}${playersHtml}${gamesHtml}${enterHtml}
    ${S.lastError ? `<p class="text-sm text-red-400">${escapeHtml(S.lastError)}</p>` : ''}`;
  box.querySelectorAll('.pick-tv').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'pair-tv', tvId: b.dataset.tv }));
  });
  box.querySelectorAll('[data-pick-game]').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'set-game', game: b.dataset.pickGame }));
  });
  box.querySelectorAll('[data-suggest-game]').forEach((b) => {
    b.onclick = () => S.ws?.send(JSON.stringify({ type: 'suggest', game: b.dataset.suggestGame }));
  });
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) resetBtn.onclick = () => S.ws?.send(JSON.stringify({ type: 'reset-round' }));
  const tolobby = document.getElementById('btn-tolobby');
  if (tolobby) tolobby.onclick = () => S.ws?.send(JSON.stringify({ type: 'set-game', game: 'lobby' }));
}
