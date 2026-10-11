const { WebSocketServer } = require('ws');
const rooms = require('./rooms');
const db = require('./db');
const log = require('./logger');
const { joinUrlFor, roomQr } = require('./qr');

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

function broadcastState(code) {
  const room = rooms.getRoom(code);
  if (!room) return;
  const msg = JSON.stringify({ type: 'room-state', ...fullState(room) });
  const tv = room.tvId ? tvs.get(room.tvId) : null;
  if (tv?.ws && tv.ws.readyState === 1) tv.ws.send(msg);
  for (const ws of playerSockets.values()) {
    if (ws.meta?.room === code && ws.readyState === 1) ws.send(msg);
  }
}

function broadcastTvList() {
  const msg = JSON.stringify({ type: 'tv-list', tvs: idleTvs() });
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
  const msg = JSON.stringify({ type: 'rooms-list', rooms: publicRooms() });
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
      send(tv.ws, { type: 'tv-idle', tvId: room.tvId, tvName: tv.name });
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

function handleTvJoin(ws, msg) {
  let tvId = typeof msg.tvId === 'string' && msg.tvId.length >= 4 && msg.tvId.length <= 64 ? msg.tvId : genTvId();
  let entry = tvs.get(tvId);
  if (entry?.ws && entry.ws !== ws && entry.ws.readyState === 1) {
    tvId = genTvId();
    entry = null;
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
      send(ws, { type: 'tv-paired', tvId, room: room.code, tvName: entry.name, joinUrl, qrDataUrl });
      send(ws, JSON.stringify({ type: 'room-state', ...fullState(room) }));
    }).catch((e) => log.error(e));
  } else {
    entry.roomCode = null;
    send(ws, { type: 'tv-idle', tvId, tvName: entry.name });
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
  send(ws, { type: 'tv-list', tvs: idleTvs() });
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
      send(old.ws, { type: 'tv-idle', tvId: room.tvId, tvName: old.name });
    }
  }
  room.tvId = tvId;
  entry.roomCode = room.code;
  const joinUrl = joinUrlFor(room.code, ws.host);
  const qrDataUrl = await roomQr(joinUrl);
  log.debug(`Room ${room.code} QR -> ${joinUrl}`);
  send(entry.ws, { type: 'tv-paired', tvId, room: room.code, tvName: entry.name, joinUrl, qrDataUrl });
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

function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return send(ws, { type: 'error', message: 'JSON invalide' });
  }

  if (msg.type === 'join') {
    if (msg.role === 'tv') { log.debug('WS recv join tv'); return handleTvJoin(ws, msg); }
    if (msg.role === 'player') { log.debug(`WS recv join player room=${msg.room}`); return handlePlayerJoin(ws, msg); }
    log.debug('WS recv join role invalide');
    return send(ws, { type: 'error', message: 'role invalide' });
  }
  if (msg.type === 'create-room') { log.debug('WS recv create-room'); return handleCreateRoom(ws, msg); }
  if (msg.type === 'ping') return send(ws, { type: 'pong' });
  if (msg.type === 'list-rooms') { log.debug('WS recv list-rooms'); return send(ws, { type: 'rooms-list', rooms: publicRooms() }); }

  const meta = ws.meta;
  if (!meta?.room) { log.debug(`WS refused ${msg.type}: join requis`); return send(ws, { type: 'error', message: 'join requis' }); }
  const room = rooms.getRoom(meta.room);
  if (!room) { log.debug(`WS refused ${msg.type}: salon ${meta.room} introuvable`); return send(ws, { type: 'error', code: 'room-not-found', message: 'salon introuvable' }); }
  log.debug(`WS recv ${msg.type} room=${room.code} player=${meta.playerId || meta.tvId}`);

  if (msg.type === 'leave') return handleLeave(ws, meta, room);

  if (msg.type === 'pair-tv') {
    log.debug(`WS recv pair-tv tvId=${msg.tvId} room=${room.code}`);
    handlePairTv(ws, meta, room, msg.tvId).catch((e) => {
      log.error(e);
      send(ws, { type: 'error', message: 'erreur interne' });
    });
    return;
  }

  if (msg.type === 'set-game') {
    if (!canManage(meta, room)) { log.debug(`WS refused set-game room=${room.code}: pas gerant`); return send(ws, { type: 'error', message: 'réservé au gérant de session' }); }
    if (!rooms.setGame(room, msg.game)) { log.debug(`WS refused set-game room=${room.code}: jeu inconnu ${msg.game}`); return send(ws, { type: 'error', message: 'jeu inconnu' }); }
    log.info(`Room ${room.code} game -> ${msg.game}`);
    broadcastState(room.code);
    broadcastRoomsList();
    return;
  }

  if (msg.type === 'reset-round') {
    if (!canManage(meta, room)) { log.debug(`WS refused reset-round room=${room.code}: pas gerant`); return send(ws, { type: 'error', message: 'réservé au gérant de session' }); }
    rooms.resetRound(room);
    log.debug(`Room ${room.code} reset-round`);
    return broadcastState(room.code);
  }

  if (msg.type === 'ready') {
    if (meta.role !== 'player') return;
    rooms.setReady(room, meta.playerId, msg.ready !== false);
    log.debug(`Room ${room.code} ready ${meta.playerId}=${msg.ready !== false}`);
    return broadcastState(room.code);
  }

  if (msg.type === 'start-game') {
    if (!canManage(meta, room)) return send(ws, { type: 'error', message: 'réservé au gérant de session' });
    const r = rooms.tryStart(room);
    if (r !== 'ok') { log.debug(`WS refused start-game room=${room.code}: ${r}`); }
    if (r === 'wait-opponent') return send(ws, { type: 'error', message: 'en attente d\u2019un adversaire' });
    if (r === 'not-ready') return send(ws, { type: 'error', message: 'les 2 joueurs doivent être prêts' });
    log.info(`Room ${room.code} started ${room.game}`);
    return broadcastState(room.code);
  }

  if (msg.type === 'rematch') {
    if (!canManage(meta, room)) return send(ws, { type: 'error', message: 'réservé au gérant de session' });
    if (room.game === 'puissance4' && room.started && room.connect4 && !room.connect4.winnerId && !room.connect4.isDraw) {
      log.debug(`WS refused rematch room=${room.code}: partie en cours`);
      return send(ws, { type: 'error', message: 'partie en cours' });
    }
    rooms.resetRound(room);
    room.ready = {};
    rooms.setReady(room, meta.playerId, true);
    const from = (room.players.get(meta.playerId) || {}).name || '?';
    log.info(`Room ${room.code} rematch propose par ${from}`);
    broadcastState(room.code);
    const offer = JSON.stringify({ type: 'rematch-offer', room: room.code, from });
    for (const s of playerSockets.values()) {
      if (s !== ws && s.meta && s.meta.room === room.code && s.readyState === 1) s.send(offer);
    }
    return;
  }

  if (msg.type === 'rematch-decline') {
    if (meta.role !== 'player') return;
    const by = (room.players.get(meta.playerId) || {}).name || '?';
    log.debug(`Room ${room.code} rematch refuse par ${by}`);
    const hostSock = [...playerSockets.values()].find((s) => s.meta && s.meta.room === room.code && s.meta.playerId === room.hostId);
    if (hostSock && hostSock.readyState === 1) hostSock.send(JSON.stringify({ type: 'rematch-declined', room: room.code, by }));
    return;
  }

  if (msg.type === 'set-color') {
    if (meta.role !== 'player') return;
    const r = rooms.setPlayerColor(room, meta.playerId, msg.color);
    if (r !== 'ok') { log.debug(`WS refused set-color room=${room.code}: ${r} (${msg.color})`); }
    if (r === 'unknown') return send(ws, { type: 'error', message: 'couleur inconnue' });
    if (r === 'taken') return send(ws, { type: 'error', message: 'couleur déjà prise' });
    log.debug(`Room ${room.code} color ${meta.playerId} -> ${msg.color}`);
    return broadcastState(room.code);
  }

  if (msg.type === 'input') {
    if (meta.role !== 'player') return;
    const action = String(msg.action || '');
    if (action !== 'drop') { log.debug(`WS ignored input room=${room.code}: action ${action}`); return; }
    const wasOver = !!(room.connect4 && (room.connect4.winnerId || room.connect4.isDraw));
    const res = rooms.handleInput(room, meta.playerId, action, msg.col);
    log.debug(`Room ${room.code} drop col=${msg.col} player=${meta.playerId} accepted=${res.accepted}`);
    if (!wasOver && room.connect4 && (room.connect4.winnerId || room.connect4.isDraw)) {
      try {
        const ids = [...room.players.keys()];
        db.recordMatch({
          game: room.game,
          player1Id: ids[0],
          player2Id: ids[1],
          winnerId: room.connect4.winnerId,
          isDraw: room.connect4.isDraw,
          room: room.code,
        });
      } catch (e) { log.error(e); }
    }
    return broadcastState(room.code);
  }
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {}
    if (pathname !== '/ws') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.host = req.headers.host;
    lobbySockets.add(ws);
    log.debug(`WS open from ${req.socket.remoteAddress} (${wss.clients.size} clients)`);
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data) => {
      try {
        handleMessage(ws, data.toString());
      } catch (e) {
        log.error(e);
        send(ws, { type: 'error', message: 'erreur interne' });
      }
    });
    ws.on('close', (code, reason) => { log.debug(`WS close ${code} ${reason || ''}`.trim()); cleanup(ws); });
    ws.on('error', () => cleanup(ws));
  });

  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        cleanup(ws);
        ws.terminate();
      } else {
        ws.isAlive = false;
        try { ws.ping(); } catch {}
      }
    }
  }, 30000);
  wss.on('close', () => clearInterval(interval));

  return wss;
}

module.exports = { setupWebSocket, BOOT_ID };
