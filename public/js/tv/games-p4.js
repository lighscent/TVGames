import { S, stage } from './state.js';
import { escapeHtml } from './utils.js';
import { playerName } from './players.js';
import { duelPanel } from './duel.js';

let prevGrid = null;

export function renderP4() {
  const c4 = S.state.connect4;
  const dot = (id) => `<span class="inline-block h-[2vmin] w-[2vmin] rounded-full ${c4.colorBg[id] || 'bg-zinc-600'}"></span>`;
  const readyMark = (id) => S.state.ready[id]
    ? '<i class="fa-solid fa-check text-emerald-400"></i>'
    : '<i class="fa-solid fa-hourglass-half text-zinc-500"></i>';
  if (!S.state.started) {
    prevGrid = null;
    const vs = c4.red && c4.yellow
      ? `${dot(c4.red)} ${escapeHtml(playerName(c4.red))} ${readyMark(c4.red)} vs ${dot(c4.yellow)} ${escapeHtml(playerName(c4.yellow))} ${readyMark(c4.yellow)}`
      : 'En attente de 2 joueurs…';
    stage.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center">
        <h2 class="text-[5vmin] font-bold">Puissance 4 — préparation</h2>
        <p class="mt-[2vmin] text-[3.4vmin]">${vs}</p>
        ${duelPanel()}
        <p class="mt-[2vmin] text-[2.4vmin] text-zinc-400">Choisissez votre couleur sur mobile, mettez-vous prêts — le gérant lancera la partie.</p>
      </div>`;
  } else {
    const winSet = new Set((c4.winCells || []).map(([r, c]) => `${r},${c}`));
    let falling = null;
    if (prevGrid) {
      for (let r = 0; r < 6 && !falling; r++) {
        for (let c = 0; c < 7; c++) {
          if ((prevGrid[r][c] === null || prevGrid[r][c] === undefined) && c4.grid[r][c] !== null && c4.grid[r][c] !== undefined) { falling = `${r},${c}`; break; }
        }
      }
    }
    prevGrid = c4.grid.map((rowArr) => [...rowArr]);
    const tokenClass = (v, r, c) => {
      const base = 'aspect-square rounded-full';
      if (v !== null && v !== undefined) return `${base} ${c4.colorBg[v] || 'bg-zinc-500'}${winSet.has(`${r},${c}`) ? ' ring-4 ring-emerald-400' : ''}`;
      return `${base} bg-zinc-800`;
    };
    const board = c4.grid.map((rowArr, r) =>
      rowArr.map((v, c) => falling === `${r},${c}`
        ? `<div class="${tokenClass(v, r, c)} c4-drop" style="--fall:-${(r + 1) * 100}%"></div>`
        : `<div class="${tokenClass(v, r, c)}"></div>`).join('')
    ).join('');
    const dot = (id) => `<span class="inline-block h-[2vmin] w-[2vmin] rounded-full ${c4.colorBg[id] || 'bg-zinc-600'}"></span>`;
    const vs = c4.red && c4.yellow
      ? `${dot(c4.red)} ${escapeHtml(playerName(c4.red))} vs ${dot(c4.yellow)} ${escapeHtml(playerName(c4.yellow))}`
      : 'En attente de 2 joueurs…';
    stage.innerHTML = `<div class="flex h-full w-full flex-col items-center">
      ${c4.winnerId
        ? `<h2 class="shrink-0 text-[5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${escapeHtml(playerName(c4.winnerId))} gagne !</h2>`
        : c4.isDraw
          ? `<h2 class="shrink-0 text-[5vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</h2>`
          : `<h2 class="shrink-0 text-[4vmin] font-bold">Puissance 4</h2><p class="shrink-0 text-[2.4vmin] text-zinc-400">${vs}${c4.turn ? ` — tour de <strong class="text-white">${escapeHtml(playerName(c4.turn))}</strong>` : ''}</p>`}
      <div class="flex min-h-0 w-full flex-1 items-center justify-center pt-[1.5vmin]">
        <div data-fit-aspect="1.1" class="grid grid-cols-7 gap-[1vmin] rounded-2xl border border-zinc-800 bg-zinc-900/60 p-[1.5vmin]">${board}</div>
      </div>
    </div>`;
  }
}
