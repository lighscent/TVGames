import { S, stage } from './state.js';
import { escapeHtml } from './utils.js';
import { duel, playerName, pdot, preVsTv } from './players.js';
import { duelPanel } from './duel.js';

export function renderBataille() {
  const b = S.state.bataille;
  const d = duel();
  const size = b.size || 9;
  if (!S.state.started) {
    stage.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center">
      <h2 class="text-[5vmin] font-bold">Bataille navale — préparation</h2>
      <p class="mt-[2vmin] text-[3.4vmin]">${preVsTv()}</p>
      ${duelPanel()}
      <p class="mt-[2vmin] text-[2.4vmin] text-zinc-400">Placez vos bateaux sur mobile, mettez-vous prêts.</p>
    </div>`;
    return;
  }
  const foeShots = (id) => {
    const foe = id === d.red ? d.yellow : d.red;
    return ((b.shots || {})[foe] || {});
  };
  const ROWS = 'ABCDEFGHI';
  const head = (t) => `<div class="flex aspect-square items-center justify-center text-[1.6vmin] font-bold text-zinc-500">${t}</div>`;
  const colHead = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(head).join('');
  const OUT = ['outline-red-400', 'outline-emerald-400', 'outline-sky-400', 'outline-amber-400', 'outline-fuchsia-400'];
  const board = (id) => {
    const ships = new Set(((b.ships || {})[id] || []));
    const fIdx = {};
    (((b.fleets || {})[id] || []).forEach((f, k) => f.forEach((i) => { fIdx[i] = k; })));
    const shots = foeShots(id);
    return colHead + Array.from({ length: size }, (_, r) =>
      head(ROWS[r]) + Array.from({ length: size }, (_, c) => {
        const i = r * size + c;
        if (shots[i] === 'hit') return '<div class="flex aspect-square items-center justify-center rounded-[0.5vmin] bg-red-500 text-[1.6vmin] font-black text-white">X</div>';
        if (shots[i] === 'miss') return '<div class="flex aspect-square items-center justify-center rounded-[0.5vmin] bg-blue-900 text-[1.6vmin] text-blue-300">·</div>';
        if (ships.has(i)) return `<div class="aspect-square rounded-[0.5vmin] bg-zinc-700 outline outline-2 ${OUT[(fIdx[i] ?? 0) % 5]}"></div>`;
        return '<div class="aspect-square rounded-[0.5vmin] bg-blue-950"></div>';
      }).join('')
    ).join('');
  };
  const status = d.winnerId
    ? `<h2 class="shrink-0 text-[5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${escapeHtml(playerName(d.winnerId))} gagne !</h2>`
    : `<h2 class="shrink-0 text-[4vmin] font-bold">Bataille navale</h2><p class="shrink-0 text-[2.4vmin] text-zinc-400">${b.turn ? `Tir de <strong class="text-white">${escapeHtml(playerName(b.turn))}</strong> — un touché rejoue !` : ''}</p>`;
  stage.innerHTML = `<div class="flex h-full w-full flex-col items-center">
    ${status}
    <div class="flex min-h-0 w-full flex-1 items-center justify-center gap-[4vmin] pt-[1.5vmin]">
      ${[d.red, d.yellow].filter(Boolean).map((id) => `<div class="flex flex-col items-center">
        <p class="mb-[1vmin] text-[2.4vmin] font-bold">${pdot(id)} ${escapeHtml(playerName(id))}</p>
        <div class="grid w-[min(52vmin,44dvh)] grid-cols-10 gap-[0.4vmin]">${board(id)}</div>
      </div>`).join('')}
    </div>
  </div>`;
}
