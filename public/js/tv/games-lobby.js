import { S, stage, playersEl, countEl, currentGameEl, hostNameEl, roomCodeEl } from './state.js';
import { escapeHtml } from './utils.js';
import { playerName, pdot } from './players.js';
import { duoIds, duelPanel } from './duel.js';

export function renderIdle() {
  roomCodeEl.textContent = '—';
  currentGameEl.textContent = 'En attente';
  hostNameEl.textContent = '—';
  countEl.textContent = '0';
  playersEl.innerHTML = '';
  stage.innerHTML = `<div><p class="text-[10vmin]"><i class="fa-solid fa-tv"></i></p>
      <p class="mt-[1vmin] font-mono text-[13vmin] font-black leading-none text-emerald-400">${escapeHtml(S.tvName)}</p>
      <h2 class="mt-[2vmin] text-[4vmin] font-bold">En attente d'association</h2>
      <p class="mt-[1vmin] text-[2.4vmin] text-zinc-400">Crée un salon depuis un mobile, puis sélectionne cette TV.</p></div>`;
}

export function renderLobby() {
  const duo = duoIds();
  stage.innerHTML = duo
    ? `<div class="flex h-full w-full flex-col items-center justify-center">
        <p class="text-[5vmin] font-black leading-tight">${pdot(duo[0])} ${escapeHtml(playerName(duo[0]))} <span class="text-zinc-500">vs</span> ${escapeHtml(playerName(duo[1]))} ${pdot(duo[1])}</p>
        ${duelPanel()}
        <p class="mt-[3vmin] text-[2.2vmin] text-zinc-500">Un autre joueur ? Code <span class="font-mono text-sky-300">${S.room}</span> :</p>
        ${S.qr ? `<img src="${S.qr}" alt="QR pour rejoindre" class="mt-[1vmin] w-[14vmin] rounded-xl bg-white p-1" />` : ''}
      </div>`
    : `<div class="flex flex-wrap items-center justify-center gap-[5vmin]">
      ${S.qr ? `<img src="${S.qr}" alt="QR pour rejoindre" class="w-[30vmin] rounded-2xl bg-white p-2" />` : '<p class="text-[10vmin]"><i class="fa-solid fa-gamepad"></i></p>'}
      <div>
        <h2 class="text-[4vmin] font-bold">En attente de joueurs</h2>
        <p class="mt-[1vmin] font-mono text-[13vmin] font-black leading-none tracking-[0.2em] text-sky-400">${S.room}</p>
        <p class="mt-[2vmin] text-[2.4vmin] text-zinc-400">Sur mobile : <span class="font-mono text-sky-300">/controller?room=${S.room}</span> — entrez ce code</p>
      </div>
    </div>`;
}
