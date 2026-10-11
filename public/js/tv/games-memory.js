import { S, stage } from './state.js';
import { escapeHtml } from './utils.js';
import { duel, playerName, pdot, bgOf, preVsTv } from './players.js';
import { duelPanel } from './duel.js';

let prevFacesM = null;

export function renderMemory() {
  const m = S.state.memory;
  const d = duel();
  if (!S.state.started) {
    prevFacesM = null;
    stage.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center">
      <h2 class="text-[5vmin] font-bold">Memory — préparation</h2>
      <p class="mt-[2vmin] text-[3.4vmin]">${preVsTv()}</p>
      ${duelPanel()}
      <p class="mt-[2vmin] text-[2.4vmin] text-zinc-400">Mettez-vous prêts — le gérant lancera la partie.</p>
    </div>`;
    return;
  }
  const scorerBg = (id) => bgOf(id);
  const cells = (m.faces || []).map((f, i) => {
    const fresh = f && !(prevFacesM || [])[i] && !m.matched[i];
    const concealed = !f && (prevFacesM || [])[i] && !m.matched[i];
    if (m.matched[i]) return `<div class="flex aspect-square items-center justify-center rounded-xl text-[4.6vmin] font-black text-white opacity-60 ${scorerBg(m.matched[i])}">${escapeHtml(f || '')}</div>`;
    if (f) return `<div class="flex aspect-square items-center justify-center rounded-xl bg-sky-700 text-[4.6vmin] font-black text-white${fresh ? ' memo-flip' : ''}">${escapeHtml(f)}</div>`;
    return `<div class="flex aspect-square items-center justify-center rounded-xl bg-zinc-800 text-[2.4vmin] text-zinc-600${concealed ? ' memo-unflip' : ''}">?</div>`;
  }).join('');
  prevFacesM = m.faces || [];
  const sc = (id) => (m.scores || {})[id] || 0;
  const status = d.winnerId
    ? `<h2 class="shrink-0 text-[5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${escapeHtml(playerName(d.winnerId))} gagne !</h2>`
    : d.isDraw
      ? '<h2 class="shrink-0 text-[5vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</h2>'
      : `<h2 class="shrink-0 text-[4vmin] font-bold">Memory</h2><p class="shrink-0 text-[2.4vmin] text-zinc-400">${pdot(d.red)} ${sc(d.red)} — ${sc(d.yellow)} ${pdot(d.yellow)}${m.turn ? ` · tour de <strong class="text-white">${escapeHtml(playerName(m.turn))}</strong>` : ''}</p>`;
  stage.innerHTML = `<div class="flex h-full w-full flex-col items-center">
    ${status}
    <div class="flex min-h-0 w-full flex-1 items-center justify-center pt-[1.5vmin]">
      <div class="grid w-[min(72vmin,62dvh)] grid-cols-4 gap-[1vmin]">${cells}</div>
    </div>
  </div>`;
}
