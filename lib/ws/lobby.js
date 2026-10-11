const rooms = require('../rooms');
const db = require('../db');
const log = require('../logger');
const { joinUrlFor, roomQr } = require('../qr');
const {
  playerSockets, tvs, lobbySockets, send, genTvId, genTvName, genPlayerId,
  idleTvs, fullState, tvState, broadcastState, broadcastTvList, broadcastRoomsList, closeRoom,
  BOOT_ID,
} = require('./state');

function handleTvJoin(ws, msg) {
  let tvId = typeof msg.tvId === 'string' && msg.tvId.length >= 4 && msg.tvId.length <= 64 ? msg.tvId : genTvId();
  let entry = tvs.get(tvId);
  if (entry && entry.ws && entry.ws !== ws) {
    const old = entry.ws;
    entry.ws = null;
    try { old.close(4001, 'tv-replaced'); } catch {}
    log.debug(`TV ${entry.name} remplacee (meme tvId ${tvId})`);
  }
  if (!entry) {
    entry = { ws: null, name: genTvName(), roomCode: null };
    tvs.set(tvId, entry);
  }
  entry.ws = ws;
  ws.meta = { role: 'tv', tvId };
  lobbySockets.delete(ws);
  log.info(`TV ${entry.name} connected`);
  const room = entry.roomCode ? rooms.getRoom(entry.roomCode) : null;
  if (room && room.tvId === tvId) {
    const joinUrl = joinUrlFor(room.code, ws.host);
    roomQr(joinUrl).then((qrDataUrl) => {
      send(ws, { type: 'tv-paired', tvId, room: room.code, tvName: entry.name, joinUrl, qrDataUrl, boot: BOOT_ID });
      send(ws, JSON.stringify({ type: 'room-state', ...tvState(room) }));
    }).catch((e) => log.error(e));
  } else {
    entry.roomCode = null;
    send(ws, { type: 'tv-idle', tvId, tvName: entry.name, boot: BOOT_ID });
  }
  broadcastTvList();
}

function handlePlayerJoin(ws, msg) {
  const room = rooms.getRoom(msg.room);
  if (!room) { log.debug(`WS refused join: salon ${msg.room} introuvable`); return send(ws, { type: 'error', code: 'room-not-found', message: 'salon introuvable' }); }
  const rejoin = typeof msg.playerId === 'string' && room.players.has(msg.playerId);
  const id = typeof msg.playerId === 'string' && msg.playerId.length >= 8 && msg.playerId.length <= 64
    ? msg.playerId
    : genPlayerId();
  const playerName = String(msg.name || 'Joueur').slice(0, 20) || 'Joueur';
  let wasHost = false;
  if (ws.meta?.room === room.code && typeof ws.meta.playerId === 'string' && ws.meta.playerId !== id && room.players.has(ws.meta.playerId)) {
    wasHost = room.hostId === ws.meta.playerId;
    rooms.removePlayer(room, ws.meta.playerId);
    if (ws.meta.key) playerSockets.delete(ws.meta.key);
    log.debug(`WS rejoin: ancien id ${ws.meta.playerId} retire (${room.code})`);
  }
  rooms.addPlayer(room, id, playerName);
  if (wasHost) room.hostId = id;
  try { db.upsertPlayer(id, playerName); } catch (e) { log.error(e); }
  ws.meta = { role: 'player', room: room.code, playerId: id, key: `${room.code}:${id}:${Math.random().toString(36).slice(2)}` };
  playerSockets.set(ws.meta.key, ws);
  lobbySockets.delete(ws);
  log.info(`Player ${playerName} joined room=${room.code}${rejoin ? ' (rejoin)' : ''}`);
  send(ws, { type: 'joined', room: room.code, role: 'player', playerId: id, ...fullState(room) });
  broadcastState(room.code);
  broadcastRoomsList();
}

function handleCreateRoom(ws, msg) {
  if (ws.meta?.room) { log.debug(`WS refused create-room: deja dans ${ws.meta.room}`); return send(ws, { type: 'error', message: 'déjà dans un salon' }); }
  const room = rooms.createRoom();
  const id = genPlayerId();
  const playerName = String(msg.name || 'Joueur').slice(0, 20) || 'Joueur';
  rooms.addPlayer(room, id, playerName);
  room.creatorId = id;
  try { db.upsertPlayer(id, playerName); } catch (e) { log.error(e); }
  ws.meta = { role: 'player', room: room.code, playerId: id, key: `${room.code}:${id}:${Math.random().toString(36).slice(2)}` };
  playerSockets.set(ws.meta.key, ws);
  lobbySockets.delete(ws);
  log.info(`Player ${playerName} created room=${room.code}`);
  send(ws, { type: 'joined', room: room.code, role: 'player', playerId: id, ...fullState(room) });
  send(ws, { type: 'tv-list', tvs: idleTvs(), boot: BOOT_ID });
  broadcastState(room.code);
  broadcastRoomsList();
}

async function handlePairTv(ws, meta, room, rawTvId) {
  if (meta.role !== 'player' || meta.playerId !== room.creatorId) {
    log.debug(`WS refused pair-tv room=${room.code}: reserve createur`);
    return send(ws, { type: 'error', message: 'réservé au créateur du salon' });
  }
  const tvId = String(rawTvId || '');
  const entry = tvs.get(tvId);
  if (!entry || !entry.ws || entry.ws.readyState !== 1) {
    log.debug(`WS refused pair-tv room=${room.code}: TV ${tvId} indisponible`);
    return send(ws, { type: 'error', message: 'TV indisponible' });
  }
  if (entry.roomCode && entry.roomCode !== room.code) {
    log.debug(`WS refused pair-tv room=${room.code}: TV ${entry.name} deja utilisee`);
    return send(ws, { type: 'error', message: 'TV déjà utilisée' });
  }
  if (room.tvId && room.tvId !== tvId) {
    const old = tvs.get(room.tvId);
    if (old) {
      old.roomCode = null;
      send(old.ws, { type: 'tv-idle', tvId: room.tvId, tvName: old.name, boot: BOOT_ID });
    }
  }
  room.tvId = tvId;
  entry.roomCode = room.code;
  const joinUrl = joinUrlFor(room.code, ws.host);
  const qrDataUrl = await roomQr(joinUrl);
  log.debug(`Room ${room.code} QR -> ${joinUrl}`);
  send(entry.ws, { type: 'tv-paired', tvId, room: room.code, tvName: entry.name, joinUrl, qrDataUrl, boot: BOOT_ID });
  log.info(`Room ${room.code} paired with ${entry.name}`);
  broadcastState(room.code);
  broadcastTvList();
  broadcastRoomsList();
}

function handleLeave(ws, meta, room) {
  if (meta.role !== 'player') return;
  playerSockets.delete(meta.key);
  ws.meta = null;
  try { ws.close(4000, 'leave'); } catch {}
  if (meta.playerId === room.creatorId) {
    return closeRoom(room.code, 'Le créateur a quitté le salon.');
  }
  if (room.players.has(meta.playerId)) {
    rooms.removePlayer(room, meta.playerId);
    log.info(`Player left room=${room.code}`);
  }
  broadcastState(room.code);
  broadcastRoomsList();
}

module.exports = { handleTvJoin, handlePlayerJoin, handleCreateRoom, handlePairTv, handleLeave };
