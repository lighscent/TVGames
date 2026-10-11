import { S, stage } from './state.js';
import { escapeHtml } from './utils.js';
import { duel, playerName, iconOf, textOf, readyMarkTv } from './players.js';
import { duelPanel } from './duel.js';

export function renderTictactoe() {
  const t = S.state.tictactoe;
  const d = duel();
  if (!S.state.started) {
    const vs = d.red && d.yellow
      ? [d.red, d.yellow].map((id) => {
        const p = (S.state.players || []).find((pp) => pp.id === id) || {};
        return `<span class="inline-flex items-center gap-[1vmin] rounded-full bg-zinc-800 px-[2vmin] py-[1vmin]"><span class="${textOf(p.bg || 'bg-zinc-600')} text-[3.4vmin]"><i class="${p.icon || 'fa-solid fa-circle'}"></i></span> ${escapeHtml(p.name || '?')} ${readyMarkTv(id)}</span>`;
      }).join('<span class="mx-[1.5vmin] text-[3vmin] text-zinc-500">vs</span>')
      : 'En attente de 2 joueurs…';
    stage.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center">
      <h2 class="text-[5vmin] font-bold">Morpion — préparation</h2>
      <p class="mt-[2vmin] flex items-center text-[3.4vmin]">${vs}</p>
      ${duelPanel()}
      <p class="mt-[2vmin] text-[2.4vmin] text-zinc-400">Choisissez couleur et symbole sur mobile, mettez-vous prêts — le gérant lancera la partie.</p>
    </div>`;
    return;
  }
  const cells = t.grid.map((v, i) => v
    ? `<div class="flex aspect-square items-center justify-center rounded-xl bg-zinc-800 text-[7vmin] ${textOf(((S.state.players || []).find((p) => p.id === v) || {}).bg || 'bg-zinc-600')}${(t.winCells || []).includes(i) ? ' ring-4 ring-emerald-400' : ''}"><i class="${iconOf(v)}"></i></div>`
    : '<div class="aspect-square rounded-xl bg-zinc-800"></div>').join('');
  const status = d.winnerId
    ? `<h2 class="shrink-0 text-[5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${escapeHtml(playerName(d.winnerId))} gagne !</h2>`
    : d.isDraw
      ? '<h2 class="shrink-0 text-[5vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</h2>'
      : `<h2 class="shrink-0 text-[4vmin] font-bold">Morpion</h2><p class="shrink-0 text-[2.4vmin] text-zinc-400">${t.turn ? `Tour de <strong class="text-white">${escapeHtml(playerName(t.turn))}</strong>` : ''}</p>`;
  stage.innerHTML = `<div class="flex h-full w-full flex-col items-center">
    ${status}
    <div class="flex min-h-0 w-full flex-1 items-center justify-center pt-[1.5vmin]">
      <div class="grid w-[min(60vmin,52dvh)] grid-cols-3 gap-[1.2vmin]">${cells}</div>
    </div>
  </div>`;
}
