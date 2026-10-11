import { S } from './state.js';
import { escapeHtml } from './utils.js';
import { duel, gameName, playerName } from './players.js';

let duelCache = { key: null, data: null };

export const duoIds = () => {
  const d = duel();
  if (d.red && d.yellow && d.red !== d.yellow) return [d.red, d.yellow];
  const list = S.state?.players || [];
  if (list.length < 2) return null;
  return [list[0].id, list[1].id];
};
export const duelScope = () => (S.state && S.state.game && S.state.game !== 'lobby' ? S.state.game : 'all');
export const duelSig = () => {
  const d = duel();
  return `${S.state?.started ? 1 : 0}:${d.winnerId || ''}:${d.isDraw ? 1 : 0}`;
};
export function maybeFetchDuel(onDone) {
  const duo = duoIds();
  if (!duo || !S.room) return;
  const key = `${S.room}:${duelScope()}:${duo[0]}:${duo[1]}:${duelSig()}`;
  if (duelCache.key === key) return;
  duelCache.key = key;
  fetch(`/api/duel?game=${duelScope()}&a=${encodeURIComponent(duo[0])}&b=${encodeURIComponent(duo[1])}`)
    .then((r) => r.json())
    .then((d) => {
      if (duelCache.key !== key) return;
      duelCache.data = d;
      onDone();
    })
    .catch(() => {});
}
export const duelPanel = () => {
  const duo = duoIds();
  const d = duelCache.data;
  if (!duo || !d) return '';
  if (!d.w1 && !d.w2 && !d.draws) return '<p class="mt-[3vmin] text-[2.6vmin] text-zinc-400">Première confrontation — faites vos preuves !</p>';
  return `<div class="mt-[2.5vmin] rounded-2xl border border-amber-500/40 bg-zinc-900/60 px-[6vmin] py-[2vmin] text-center">
      <p class="text-[2.2vmin] uppercase tracking-widest text-amber-300"><i class="fa-solid fa-trophy"></i> Face-à-face · ${duelScope() === 'all' ? 'tous jeux confondus' : escapeHtml(gameName(duelScope()))}</p>
      <p class="mt-[1vmin] text-[8vmin] font-black leading-none text-white">${d.w1}<span class="mx-[2vmin] text-zinc-600">-</span>${d.w2}</p>
      <p class="mt-[1vmin] text-[2.4vmin] text-zinc-400">${escapeHtml(playerName(duo[0]))} · ${escapeHtml(playerName(duo[1]))}${d.draws ? ` · ${d.draws} nul${d.draws > 1 ? 's' : ''}` : ''}</p>
    </div>`;
};
