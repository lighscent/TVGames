import { S, UI } from './state.js';
import { setStatus, setLastError, showJoinError } from './utils.js';
import { render, syncRoute, checkBoot, deadRoom, backToJoin } from './router.js';
import { renderRooms } from './join.js';

export function connect() {
  S.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  S.ws.onopen = () => {
    setStatus('connecté', 'bg-emerald-400');
    // Valeurs live : S.storedRoom est figé au chargement, S.myRoom/sessionStorage couvrent le créateur
    const roomCode = (UI.roomInput.value.trim() || S.myRoom || S.storedRoom || sessionStorage.getItem('tvgames-room') || '').toUpperCase();
    const liveId = S.myId || sessionStorage.getItem('tvgames-player-id') || null;
    const liveName = S.myName || sessionStorage.getItem('tvgames-player-name') || '';
    if (liveId) S.myId = liveId;
    if (liveName) S.myName = liveName;
    if (roomCode) S.storedRoom = S.storedRoom || roomCode;
    if (!S.joined && liveId && liveName && roomCode) {
      S.ws.send(JSON.stringify({ type: 'join', role: 'player', room: roomCode, name: liveName, playerId: liveId }));
    } else if (!S.joined) {
      S.ws.send(JSON.stringify({ type: 'list-rooms' }));
    }
  };
  S.ws.onclose = () => {
    S.joined = false;
    setStatus('déconnecté — reconnexion…', 'bg-red-400');
    setTimeout(connect, 2000);
  };
  S.ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'reload') { location.reload(); return; }
    if (msg.type === 'joined') {
      if (checkBoot(msg)) return;
      S.joined = true;
      S.myId = msg.playerId;
      S.myName = S.myName || sessionStorage.getItem('tvgames-player-name') || '';
      sessionStorage.setItem('tvgames-player-id', S.myId);
      sessionStorage.setItem('tvgames-room', msg.room);
      S.myRoom = msg.room;
      S.storedRoom = msg.room;
      if (UI.roomInput) UI.roomInput.value = msg.room;
      S.state = msg;
      render();
    } else if (msg.type === 'room-state') {
      if (checkBoot(msg)) return;
      if (!msg.started || S.state?.connect4?.turn !== msg.connect4?.turn) S.pendingCol = null;
      if (!msg.started) S.prevGridM = null;
      S.state = msg;
      setLastError(null);
      syncRoute();
    } else if (msg.type === 'tv-list') {
      if (checkBoot(msg)) return;
      S.tvsIdle = msg.tvs || [];
      if (S.joined) render();
    } else if (msg.type === 'rooms-list') {
      if (checkBoot(msg)) return;
      S.openRooms = msg.rooms || [];
      if (!S.joined) renderRooms();
    } else if (msg.type === 'room-closed') {
      backToJoin(msg.reason || 'Salon fermé.');
    } else if (msg.type === 'rematch-offer') {
      S.rematchOffer = { room: msg.room, from: msg.from };
      if (S.joined) syncRoute();
    } else if (msg.type === 'rematch-declined') {
      setLastError(`${msg.by} a refusé la revanche.`);
      if (S.joined) render();
    } else if (msg.type === 'error') {
      if (msg.code === 'room-not-found' || msg.message === 'salon introuvable') {
        deadRoom('Salon introuvable — il a été fermé ou le code est erroné. Choisis un salon détecté ou crée le tien.');
        return;
      }
      setLastError(msg.message);
      showJoinError(msg.message);
      if (typeof render === 'function' && S.joined) render();
    }
  };
}
