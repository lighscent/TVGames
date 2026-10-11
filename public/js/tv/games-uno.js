import { S, stage } from './state.js';
import { escapeHtml } from './utils.js';
import { duel, playerName, pdot, preVsTv } from './players.js';
import { duelPanel } from './duel.js';

const UNO_BG = { r: 'bg-red-500', b: 'bg-blue-500', g: 'bg-green-500', y: 'bg-yellow-400' };
const UNO_NAME = { r: 'Rouge', b: 'Bleu', g: 'Vert', y: 'Jaune' };

export function unoCardHtml(card, big) {
  if (!card) return `<div class="flex ${big ? 'h-[26vmin] w-[18vmin] text-[6vmin]' : 'h-[12vmin] w-[9vmin] text-[3.4vmin]'} items-center justify-center rounded-2xl bg-zinc-800 font-black">?</div>`;
  const bg = card.kind === '+4' ? 'bg-zinc-950 border-2 border-white' : (UNO_BG[card.color] || 'bg-zinc-700');
  const label = card.kind === 'num' ? card.value : card.kind === 'block' ? 'STOP' : card.kind === '+2' ? '+2' : card.kind === 'reverse' ? '<i class="fa-solid fa-arrows-rotate"></i>' : '+4';
  return `<div class="flex ${big ? 'h-[26vmin] w-[18vmin] text-[5vmin]' : 'h-[12vmin] w-[9vmin] text-[3vmin]'} items-center justify-center rounded-2xl font-black text-white ${bg}">${label}</div>`;
}

export function renderUno() {
  const u = S.state.uno;
  const d = duel();
  if (!S.state.started) {
    stage.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center">
      <h2 class="text-[5vmin] font-bold">Uno — préparation</h2>
      <p class="mt-[2vmin] text-[3.4vmin]">${preVsTv()}</p>
      ${duelPanel()}
      <p class="mt-[2vmin] text-[2.4vmin] text-zinc-400">7 cartes chacun — mettez-vous prêts.</p>
    </div>`;
    return;
  }
  const counts = u.counts || {};
  const status = d.winnerId
    ? `<h2 class="shrink-0 text-[5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${escapeHtml(playerName(d.winnerId))} gagne !</h2>`
    : `<h2 class="shrink-0 text-[4vmin] font-bold">Uno</h2><p class="shrink-0 text-[2.4vmin] text-zinc-400">${u.color ? `Couleur : <strong class="text-white">${UNO_NAME[u.color] || u.color}</strong>` : ''}${u.turn ? ` · tour de <strong class="text-white">${escapeHtml(playerName(u.turn))}</strong>` : ''}</p>`;
  stage.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center gap-[2vmin]">
    ${status}
    ${unoCardHtml(u.top, true)}
    <p class="text-[3vmin]">${[d.red, d.yellow].filter(Boolean).map((id) => `${pdot(id)} ${escapeHtml(playerName(id))} : <strong class="text-white">${counts[id] ?? '?'}</strong>`).join(' &nbsp;·&nbsp; ')}</p>
  </div>`;
}
