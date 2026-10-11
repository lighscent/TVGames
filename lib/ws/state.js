const rooms = require('../rooms');
const log = require('../logger');

const playerSockets = new Map();
const tvs = new Map();
const lobbySockets = new Set();
const BOOT_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const TV_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function genTvId() {
  return `tv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function genTvName() {
  let name;
  const taken = new Set([...tvs.values()].map((t) => t.name));
  do {
    name = `TV-${Array.from({ length: 4 }, () => TV_ALPHABET[Math.floor(Math.random() * TV_ALPHABET.length)]).join('')}`;
  } while (taken.has(name));
  return name;
}

function genPlayerId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function idleTvs() {
  return [...tvs.entries()]
    .filter(([, t]) => !t.roomCode && t.ws && t.ws.readyState === 1)
    .map(([tvId, t]) => ({ tvId, name: t.name }));
}

function fullState(room) {
  const tv = room.tvId ? tvs.get(room.tvId) : null;
  return {
    ...rooms.state(room),
    boot: BOOT_ID,
    pairedTv: tv ? { tvId: room.tvId, name: tv.name } : null,
  };
}

function tvState(room) {
  const s = fullState(room);
  return { ...s, bataille: { ...s.bataille, ships: {} } };
}

function broadcastState(code) {
  const room = rooms.getRoom(code);
  if (!room) return;
  const msg = JSON.stringify({ type: 'room-state', ...fullState(room) });
  const tvMsg = JSON.stringify({ type: 'room-state', ...tvState(room) });
  const tv = room.tvId ? tvs.get(room.tvId) : null;
  if (tv?.ws && tv.ws.readyState === 1) tv.ws.send(tvMsg);
  for (const ws of playerSockets.values()) {
    if (ws.meta?.room === code && ws.readyState === 1) ws.send(msg);
  }
}

function broadcastTvList() {
  const msg = JSON.stringify({ type: 'tv-list', tvs: idleTvs(), boot: BOOT_ID });
  for (const ws of playerSockets.values()) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function publicRooms() {
  return [...rooms.rooms.values()].map((r) => ({
    code: r.code,
    game: r.game,
    players: r.players.size,
    host: (r.players.get(r.hostId) || {}).name || '—',
    tv: r.tvId ? (tvs.get(r.tvId) || {}).name || null : null,
  }));
}

function broadcastRoomsList() {
  const msg = JSON.stringify({ type: 'rooms-list', rooms: publicRooms(), boot: BOOT_ID });
  for (const ws of lobbySockets) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function canManage(meta, room) {
  return meta.role === 'player' && !!meta.playerId && meta.playerId === room.hostId;
}

function closeRoom(code, reason) {
  const room = rooms.getRoom(code);
  if (!room) return;
  if (room.tvId) {
    const tv = tvs.get(room.tvId);
    if (tv) {
      tv.roomCode = null;
      send(tv.ws, { type: 'tv-idle', tvId: room.tvId, tvName: tv.name, boot: BOOT_ID });
    }
  }
  const msg = JSON.stringify({ type: 'room-closed', room: code, reason });
  for (const ws of playerSockets.values()) {
    if (ws.meta?.room === code) {
      if (ws.readyState === 1) ws.send(msg);
      setTimeout(() => { try { ws.close(4000, 'room-closed'); } catch {} }, 500);
    }
  }
  rooms.deleteRoom(code);
  log.info(`Room ${code} closed (${reason})`);
  broadcastTvList();
  broadcastRoomsList();
}

function cleanup(ws) {
  lobbySockets.delete(ws);
  const meta = ws.meta;
  if (!meta) { log.debug('WS cleanup: socket sans meta'); return; }
  if (meta.role === 'tv') {
    const entry = tvs.get(meta.tvId);
    if (entry && entry.ws === ws) {
      entry.ws = null;
      if (entry.roomCode) {
        const code = entry.roomCode;
        entry.roomCode = null;
        closeRoom(code, 'La TV s\'est déconnectée.');
      }
      tvs.delete(meta.tvId);
      log.debug(`WS cleanup: TV ${entry.name} supprimee`);
      broadcastTvList();
    }
  } else if (meta.role === 'player' && meta.playerId) {
    playerSockets.delete(meta.key);
    const room = rooms.getRoom(meta.room);
    if (room && room.players.has(meta.playerId)) {
      const stillConnected = [...playerSockets.values()].some(
        (s) => s.meta?.room === meta.room && s.meta?.playerId === meta.playerId
      );
      if (!stillConnected) {
        const name = room.players.get(meta.playerId)?.name;
        rooms.removePlayer(room, meta.playerId);
        log.info(`Player ${name} left room=${meta.room}`);
        broadcastState(meta.room);
        broadcastRoomsList();
      } else {
        log.debug(`WS cleanup: player ${meta.playerId} garde un autre socket room=${meta.room}`);
      }
    } else {
      log.debug(`WS cleanup: player ${meta.playerId} hors salon`);
    }
  }
}

module.exports = {
  playerSockets,
  tvs,
  lobbySockets,
  BOOT_ID,
  TV_ALPHABET,
  send,
  genTvId,
  genTvName,
  genPlayerId,
  idleTvs,
  fullState,
  broadcastState,
  broadcastTvList,
  publicRooms,
  broadcastRoomsList,
  canManage,
  closeRoom,
  cleanup,
  tvState,
};
