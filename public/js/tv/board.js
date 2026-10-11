import { S } from './state.js';
import { escapeHtml } from './utils.js';
import { gameName } from './players.js';
import { duelSig } from './duel.js';

let boardCache = { key: null, data: null };

export function maybeFetchBoard(onDone) {
  const key = `${S.room || 'idle'}:${duelSig()}`;
  if (boardCache.key === key) return;
  boardCache.key = key;
  fetch('/api/scores')
    .then((r) => r.json())
    .then((d) => {
      if (boardCache.key !== key) return;
      boardCache.data = d;
      onDone();
    })
    .catch(() => {});
}

const medal = ['text-amber-300', 'text-slate-300', 'text-amber-600'];
const scorow = (i, r) => `<div class="flex items-center gap-[1.2vmin] text-[2.6vmin]">
    <span class="w-[3.4vmin] shrink-0 text-center font-black ${medal[i] || 'text-zinc-500'}">${i + 1}</span>
    <span class="min-w-0 flex-1 truncate text-left font-medium text-white">${escapeHtml(r.name)}</span>
    <span class="font-bold text-emerald-400">${r.wins}</span><span class="text-zinc-400"> / ${r.draws} / </span><span class="text-red-400">${r.losses}</span>
  </div>`;

const section = (title, rows) => `<p class="mb-[0.5vmin] mt-[1.5vmin] text-[2vmin] font-bold uppercase tracking-widest text-sky-300">${escapeHtml(title)}</p>
  <div class="space-y-[0.5vmin]">${rows.map((r, i) => scorow(i, r)).join('')}</div>`;

export const boardHtml = () => {
  const d = boardCache.data;
  let body = '<p class="mt-[1vmin] text-[2vmin] text-zinc-500">Chargement…</p>';
  if (d) {
    const parts = [];
    if (d.global && d.global.length) parts.push(section('Global', d.global.slice(0, 5)));
    for (const [g, rows] of Object.entries(d.byGame || {})) {
      if (rows && rows.length) parts.push(section(gameName(g), rows.slice(0, 3)));
    }
    body = parts.length ? parts.join('') : '<p class="mt-[1vmin] text-[2vmin] text-zinc-500">Pas encore de matchs — à vous de jouer !</p>';
  }
  return `<div class="flex h-full min-h-0 flex-col overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900/60 p-[2vmin]">
    <p class="text-[2.8vmin] font-bold uppercase tracking-widest text-amber-300"><i class="fa-solid fa-trophy"></i> Leaderboard</p>
    <p class="mb-[1vmin] text-[1.8vmin] text-zinc-500"><span class="font-bold text-emerald-400">victoires</span> / nuls / <span class="text-red-400">défaites</span></p>${body}</div>`;
};

export const withBoard = (html) => `<div class="relative flex h-full w-full items-center justify-center">
  <div class="absolute left-0 top-0 h-full w-[32%]">${boardHtml()}</div>
  <div class="min-w-0 flex-1">${html}</div></div>`;
