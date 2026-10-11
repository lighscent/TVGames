import { S, UI, GAMES, PREFILLED_ROOM } from './state.js';
import { escapeHtml, showJoinError } from './utils.js';
import { backToJoin } from './router.js';

function getNames() {
  try { return JSON.parse(localStorage.getItem('tvgames-names') || '[]'); } catch { return []; }
}

function renderNameHistory() {
  const dl = document.getElementById('name-history');
  if (dl) dl.innerHTML = getNames().map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
}

function saveName(name) {
  if (!name || name === 'Joueur') return;
  const names = [name, ...getNames().filter((n) => n !== name)].slice(0, 5);
  try { localStorage.setItem('tvgames-names', JSON.stringify(names)); } catch {}
  renderNameHistory();
}

export function renderRooms() {
  const box = document.getElementById('rooms-list');
  if (!box) return;
  if (!S.openRooms.length) {
    box.innerHTML = '<p class="text-xs text-zinc-500">Aucun salon ouvert — crée le tien.</p>';
    return;
  }
  const gameName = (id) => (GAMES.find((g) => g.id === id) || {}).name || id;
  box.innerHTML = S.openRooms.map((r) => `<button data-room="${r.code}" class="pick-room flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-left active:bg-sky-950">
      <span><span class="font-mono font-bold text-sky-400">${r.code}</span> <span class="text-sm font-medium">${escapeHtml(r.host)}</span>
      <span class="block text-xs text-zinc-400">${escapeHtml(gameName(r.game))} · ${r.players} joueur(s)${r.tv ? ` · <i class="fa-solid fa-tv"></i> ${escapeHtml(r.tv)}` : ' · sans TV'}</span></span>
      <i class="fa-solid fa-chevron-right text-zinc-500"></i>
    </button>`).join('');
  box.querySelectorAll('.pick-room').forEach((b) => {
    b.onclick = () => {
      UI.roomInput.value = b.dataset.room;
      UI.joinBtn.click();
    };
  });
}

export function initJoin() {
  if (S.myName) UI.nameInput.value = S.myName;
  renderNameHistory();
  const pendingError = sessionStorage.getItem('tvgames-join-error') || '';
  if (pendingError) {
    sessionStorage.removeItem('tvgames-join-error');
    showJoinError(pendingError);
  }
  const urlRoom = new URLSearchParams(location.search).get('room');
  const initialRoom = (urlRoom || S.storedRoom || PREFILLED_ROOM || '').toUpperCase();
  if (initialRoom) UI.roomInput.value = initialRoom;

  UI.joinBtn.onclick = () => {
    const name = UI.nameInput.value.trim() || 'Joueur';
    const roomCode = UI.roomInput.value.trim().toUpperCase();
    if (!roomCode) {
      showJoinError('Entre le code du salon affiché sur la TV.');
      return;
    }
    UI.joinError.classList.add('hidden');
    sessionStorage.setItem('tvgames-player-name', name);
    S.myName = name;
    saveName(name);
    const sendJoin = () => S.ws.send(JSON.stringify({ type: 'join', role: 'player', room: roomCode, name, playerId: S.myId }));
    if (S.ws && S.ws.readyState === 1) sendJoin();
    else {
      showJoinError('Connexion au serveur… réessaie dans 1s.');
    }
  };

  UI.createBtn.onclick = () => {
    const name = UI.nameInput.value.trim() || 'Joueur';
    UI.joinError.classList.add('hidden');
    sessionStorage.setItem('tvgames-player-name', name);
    S.myName = name;
    saveName(name);
    if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ type: 'create-room', name }));
    else {
      showJoinError('Connexion au serveur… réessaie dans 1s.');
    }
  };

  document.getElementById('btn-refresh-rooms').onclick = () => {
    if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ type: 'list-rooms' }));
  };

  document.querySelectorAll('.btn-leave').forEach((b) => {
    let armed = false;
    let timer = null;
    b.onclick = () => {
      if (!armed) {
        armed = true;
        b.dataset.label = b.textContent;
        b.textContent = 'Sûr ? Re-tap pour quitter';
        b.classList.add('border-red-500', 'text-red-400');
        timer = setTimeout(() => {
          armed = false;
          b.textContent = b.dataset.label || 'Quitter';
          b.classList.remove('border-red-500', 'text-red-400');
        }, 3000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ type: 'leave' }));
      S.myId = null;
      S.joined = false;
      sessionStorage.removeItem('tvgames-player-id');
      sessionStorage.removeItem('tvgames-room');
      backToJoin();
    };
  });
}
