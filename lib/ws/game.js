const rooms = require('../rooms');
const db = require('../db');
const log = require('../logger');
const { playerSockets, send, canManage, broadcastState, broadcastRoomsList } = require('./state');

function handleGameMessage(ws, meta, room, msg) {
  if (msg.type === 'set-game') {
    if (!canManage(meta, room)) { log.debug(`WS refused set-game room=${room.code}: pas gerant`); return send(ws, { type: 'error', message: 'réservé au gérant de session' }); }
    if (!rooms.setGame(room, msg.game)) { log.debug(`WS refused set-game room=${room.code}: jeu inconnu ${msg.game}`); return send(ws, { type: 'error', message: 'jeu inconnu' }); }
    log.info(`Room ${room.code} game -> ${msg.game}`);
    broadcastState(room.code);
    broadcastRoomsList();
    return;
  }

  if (msg.type === 'suggest') {
    if (meta.role !== 'player') return;
    if (!rooms.setPick(room, meta.playerId, msg.game)) { log.debug(`WS refused suggest room=${room.code}: jeu inconnu ${msg.game}`); return send(ws, { type: 'error', message: 'jeu inconnu' }); }
    return broadcastState(room.code);
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
    const go = rooms.gameOver(room);
    if (room.game !== 'lobby' && room.started && !go.winnerId && !go.isDraw) {
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

  if (msg.type === 'forfeit') {
    if (meta.role !== 'player') return;
    const res = rooms.forfeit(room, meta.playerId);
    if (!res) { log.debug(`WS refused forfeit room=${room.code}: partie non abandonnable`); return send(ws, { type: 'error', message: 'abandon impossible' }); }
    try {
      const ids = [...room.players.keys()];
      db.recordMatch({
        game: room.game,
        player1Id: ids[0],
        player2Id: ids[1],
        winnerId: res.winnerId,
        isDraw: false,
        room: room.code,
      });
    } catch (e) { log.error(e); }
    log.info(`Room ${room.code} forfeit by ${meta.playerId} -> winner=${res.winnerId}`);
    return broadcastState(room.code);
  }

  if (msg.type === 'rematch-decline') {    if (meta.role !== 'player') return;
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

  if (msg.type === 'set-symbol') {
    if (meta.role !== 'player') return;
    const r = rooms.setPlayerSymbol(room, meta.playerId, msg.symbol);
    if (r !== 'ok') { log.debug(`WS refused set-symbol room=${room.code}: ${r} (${msg.symbol})`); }
    if (r === 'unknown') return send(ws, { type: 'error', message: 'symbole inconnu' });
    if (r === 'taken') return send(ws, { type: 'error', message: 'symbole déjà pris' });
    log.debug(`Room ${room.code} symbol ${meta.playerId} -> ${msg.symbol}`);
    return broadcastState(room.code);
  }

  if (msg.type === 'place-ships') {
    if (meta.role !== 'player') return;
    const r = rooms.bataillePlaceManual(room, meta.playerId, msg.cells);
    if (r !== 'ok') { log.debug(`WS refused place-ships room=${room.code}: ${r}`); }
    if (r === 'invalid') return send(ws, { type: 'error', message: 'placement invalide (5-4-3-2-2 alignés)' });
    if (r === 'refused') return;
    log.debug(`Room ${room.code} ships placed by ${meta.playerId}`);
    return broadcastState(room.code);
  }

  if (msg.type === 'input') {
    if (meta.role !== 'player') return;
    const action = String(msg.action || '');
    const ACTIONS = { drop: 1, cell: 1, flip: 1, fire: 1, play: 1, draw: 1, pass: 1, color: 1 };
    if (!ACTIONS[action]) { log.debug(`WS ignored input room=${room.code}: action ${action}`); return; }
    const before = rooms.gameOver(room);
    const wasOver = !!(before.winnerId || before.isDraw);
    const res = rooms.handleInput(room, meta.playerId, action, msg.col);
    log.debug(`Room ${room.code} input ${action} col=${msg.col} player=${meta.playerId} accepted=${res.accepted}`);
    if (action === 'flip' && res.accepted && room.game === 'memory' && (room.memory.shown || []).length === 2) {
      const id = room.memory.shownId;
      setTimeout(() => {
        if (rooms.rooms.get(room.code) !== room) return;
        if (rooms.memoryConceal(room, id)) {
          log.debug(`Room ${room.code} memory auto-hide`);
          broadcastState(room.code);
        }
      }, 2000);
    }
    const after = rooms.gameOver(room);
    if (!wasOver && (after.winnerId || after.isDraw)) {
      try {
        const ids = [...room.players.keys()];
        db.recordMatch({
          game: room.game,
          player1Id: ids[0],
          player2Id: ids[1],
          winnerId: after.winnerId,
          isDraw: after.isDraw,
          room: room.code,
        });
      } catch (e) { log.error(e); }
    }
    return broadcastState(room.code);
  }
}

module.exports = { handleGameMessage };
