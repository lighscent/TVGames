const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const rooms = require('../rooms');
const log = require('../logger');
const { lobbySockets, send, publicRooms, cleanup, BOOT_ID } = require('./state');
const { handleTvJoin, handlePlayerJoin, handleCreateRoom, handlePairTv, handleLeave } = require('./lobby');
const { handleGameMessage } = require('./game');

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
  if (msg.type === 'list-rooms') { log.debug('WS recv list-rooms'); return send(ws, { type: 'rooms-list', rooms: publicRooms(), boot: BOOT_ID }); }

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

  return handleGameMessage(ws, meta, room, msg);
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

  watchFront(wss);

  return wss;
}

function watchFront(wss) {
  let timer = null;
  const push = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      log.info('Front modifie -> reload clients');
      const msg = JSON.stringify({ type: 'reload' });
      for (const ws of wss.clients) {
        if (ws.readyState === 1) ws.send(msg);
      }
    }, 400);
  };
  for (const dir of ['public', 'views']) {
    try {
      fs.watch(path.join(__dirname, '..', '..', dir), { recursive: true }, push);
    } catch (e) { log.debug(`watch ${dir} indisponible`); }
  }
}

module.exports = { setupWebSocket, BOOT_ID };
