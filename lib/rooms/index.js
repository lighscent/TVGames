const { isValidGame } = require('../games');
const log = require('../logger');
const {
  rooms,
  createRoom,
  deleteRoom,
  getRoom,
  freshBoard,
  freshTictactoe,
  freshMemory,
  freshBataille,
  freshUno,
} = require('./registry');

const { generateRoomCode } = require('./code');

const { dropToken } = require('./games/connect4');
const { tictactoePlay } = require('./games/tictactoe');
const { memoryDeal, memoryFlip, memoryConceal } = require('./games/memory');
const { bataillePlace, batailleShips, bataillePlaceManual, batailleFire } = require('./games/bataille');
const { unoBuildDeck, unoDeal, unoPlay, unoColor, unoDraw, unoPass } = require('./games/uno');
const { contestants } = require('./games/connect4');

const { COLORS, SYMBOLS, UNO_COLORS, BAT_SIZE } = require('./constants');

function resetRound(room) {
  if (room.game === 'tictactoe') room.tictactoe = freshTictactoe();
  else if (room.game === 'memory') room.memory = freshMemory();
  else if (room.game === 'bataille') room.bataille = freshBataille();
  else if (room.game === 'uno') room.uno = freshUno();
  else room.connect4 = freshBoard();
  room.started = false;
  log.debug(`Room ${room.code} round reset (ready kept)`);
}

function setGame(room, gameId) {
  if (!isValidGame(gameId)) return false;
  room.game = gameId;
  room.ready = {};
  room.started = false;
  room.picks = {};
  resetRound(room);
  log.debug(`Room ${room.code} game=${gameId} (ready+started+picks reset)`);
  return true;
}

function setPick(room, id, gameId) {
  if (!isValidGame(gameId) || gameId === 'lobby') return false;
  room.picks = room.picks || {};
  if (room.picks[id] === gameId) delete room.picks[id];
  else room.picks[id] = gameId;
  log.debug(`Room ${room.code} pick ${id} -> ${room.picks[id] || 'none'}`);
  return true;
}

function setReady(room, id, ready) {
  if (!room.players.has(id)) return false;
  if (ready) room.ready[id] = true;
  else delete room.ready[id];
  return true;
}

function tryStart(room) {
  if (room.started) return 'already';
  if (room.game === 'lobby') { room.started = true; return 'ok'; }
  const ids = [...room.players.keys()];
  const [red, yellow] = ids;
  if (!red || !yellow) return 'wait-opponent';
  if (!room.ready[red] || !room.ready[yellow]) return 'not-ready';
  room.started = true;
  if (room.game === 'puissance4') {
    room.connect4 = room.connect4 || freshBoard();
    if (!room.connect4.turn) room.connect4.turn = require('./games/helpers').firstTurn(room, red, yellow);
    log.debug(`Room ${room.code} started, turn=${room.connect4.turn}`);
  } else if (room.game === 'tictactoe') {
    room.tictactoe = room.tictactoe || freshTictactoe();
    if (!room.tictactoe.turn) room.tictactoe.turn = require('./games/helpers').firstTurn(room, red, yellow);
    log.debug(`Room ${room.code} started tictactoe, turn=${room.tictactoe.turn}`);
  } else if (room.game === 'memory') {
    room.memory = room.memory || freshMemory();
    memoryDeal(room);
    if (!room.memory.turn) room.memory.turn = require('./games/helpers').firstTurn(room, red, yellow);
    log.debug(`Room ${room.code} started memory, turn=${room.memory.turn}`);
  } else if (room.game === 'bataille') {
    room.bataille = room.bataille || freshBataille();
    batailleShips(room, red);
    batailleShips(room, yellow);
    if (!room.bataille.turn) room.bataille.turn = require('./games/helpers').firstTurn(room, red, yellow);
    log.debug(`Room ${room.code} started bataille, turn=${room.bataille.turn}`);
  } else if (room.game === 'uno') {
    room.uno = room.uno || freshUno();
    unoDeal(room, red, yellow);
    if (!room.uno.turn) room.uno.turn = require('./games/helpers').firstTurn(room, red, yellow);
    log.debug(`Room ${room.code} started uno, turn=${room.uno.turn}`);
  }
  return 'ok';
}

function addPlayer(room, id, name) {
  const used = new Set([...room.players.values()].map((p) => p.color));
  const color = COLORS.map((c) => c.id).find((c) => !used.has(c)) || 'red';
  const usedS = new Set([...room.players.values()].map((p) => p.symbol));
  const symbol = SYMBOLS.map((s) => s.id).find((s) => !usedS.has(s)) || 'x';
  room.players.set(id, { id, name: String(name || 'Joueur').slice(0, 20), color, symbol });
  if (!room.hostId) room.hostId = id;
  if (room.creatorId && id === room.creatorId) room.hostId = id;
  log.debug(`Room ${room.code} +player ${name} color=${color} symbol=${symbol} host=${room.hostId === id}`);
}

function setPlayerSymbol(room, id, symId) {
  if (!SYMBOLS.some((s) => s.id === symId)) return 'unknown';
  const player = room.players.get(id);
  if (!player) return 'unknown-player';
  const taken = [...room.players.values()].some((p) => p.id !== id && p.symbol === symId);
  if (taken) return 'taken';
  player.symbol = symId;
  if (!room.started) delete room.ready[id];
  log.debug(`Room ${room.code} ${id} symbol -> ${symId}`);
  return 'ok';
}

function setPlayerColor(room, id, colorId) {
  if (!COLORS.some((c) => c.id === colorId)) return 'unknown';
  const player = room.players.get(id);
  if (!player) return 'unknown-player';
  const taken = [...room.players.values()].some((p) => p.id !== id && p.color === colorId);
  if (taken) return 'taken';
  player.color = colorId;
  if (!room.started) delete room.ready[id];
  log.debug(`Room ${room.code} ${id} color -> ${colorId}`);
  return 'ok';
}

function removePlayer(room, id) {
  const wasHost = room.hostId === id;
  room.players.delete(id);
  delete room.ready[id];
  if (room.picks) delete room.picks[id];
  if (room.game !== 'lobby') {
    if (room.game === 'tictactoe') room.tictactoe = freshTictactoe();
    else if (room.game === 'memory') room.memory = freshMemory();
    else if (room.game === 'bataille') room.bataille = freshBataille();
    else if (room.game === 'uno') room.uno = freshUno();
    else room.connect4 = freshBoard();
    room.started = false;
  }
  if (wasHost) {
    room.hostId = room.players.keys().next().value || null;
    log.debug(`Room ${room.code} -player ${id}, host -> ${room.hostId}`);
  } else {
    log.debug(`Room ${room.code} -player ${id}`);
  }
}

function gameOver(room) {  if (room.game === 'tictactoe') {
    const t = room.tictactoe || {};
    return { winnerId: t.winnerId || null, isDraw: !!t.isDraw };
  }
  if (room.game === 'memory') {
    const m = room.memory || {};
    return { winnerId: m.winnerId || null, isDraw: !!m.isDraw };
  }
  if (room.game === 'bataille') {
    const b = room.bataille || {};
    return { winnerId: b.winnerId || null, isDraw: false };
  }
  if (room.game === 'uno') {
    const u = room.uno || {};
    return { winnerId: u.winnerId || null, isDraw: false };
  }
  const c4 = room.connect4 || {};
  return { winnerId: c4.winnerId || null, isDraw: !!c4.isDraw };
}

function forfeit(room, playerId) {
  const ids = [...room.players.keys()];
  const [red, yellow] = ids;
  if (room.game === 'lobby' || !room.started) return null;
  if (playerId !== red && playerId !== yellow) return null;
  const over = gameOver(room);
  if (over.winnerId || over.isDraw) return null;
  const winnerId = playerId === red ? yellow : red;
  if (!winnerId) return null;
  if (room.game === 'tictactoe') {
    room.tictactoe = room.tictactoe || freshTictactoe();
    room.tictactoe.winnerId = winnerId;
  } else if (room.game === 'memory') {
    room.memory = room.memory || freshMemory();
    room.memory.winnerId = winnerId;
  } else if (room.game === 'bataille') {
    room.bataille = room.bataille || freshBataille();
    room.bataille.winnerId = winnerId;
  } else if (room.game === 'uno') {
    room.uno = room.uno || freshUno();
    room.uno.winnerId = winnerId;
  } else {
    room.connect4 = room.connect4 || freshBoard();
    room.connect4.winnerId = winnerId;
  }
  room.lastLoser = room.lastLoser || {};
  room.lastLoser[room.game] = playerId;
  log.debug(`Room ${room.code} forfeit ${playerId} -> winner=${winnerId}`);
  return { winnerId, loserId: playerId };
}

function handleInput(room, playerId, action, col) {
  if (action === 'drop' && room.game === 'puissance4') {
    return dropToken(room, playerId, col);
  }
  if (action === 'cell' && room.game === 'tictactoe') {
    return tictactoePlay(room, playerId, col);
  }
  if (action === 'flip' && room.game === 'memory') {
    return memoryFlip(room, playerId, col);
  }
  if (action === 'fire' && room.game === 'bataille') {
    return batailleFire(room, playerId, col);
  }
  if (action === 'play' && room.game === 'uno') {
    return unoPlay(room, playerId, col);
  }
  if (action === 'draw' && room.game === 'uno') {
    return unoDraw(room, playerId);
  }
  if (action === 'pass' && room.game === 'uno') {
    return unoPass(room, playerId);
  }
  if (action === 'color' && room.game === 'uno') {
    return unoColor(room, playerId, col);
  }
  return { accepted: false };
}

function bgOfColor(colorId) {
  return (COLORS.find((c) => c.id === colorId) || {}).bg || 'bg-zinc-500';
}

function glyphOfSymbol(symId) {
  return (SYMBOLS.find((s) => s.id === symId) || {}).glyph || '?';
}

function iconOfSymbol(symId) {
  return (SYMBOLS.find((s) => s.id === symId) || {}).icon || 'fa-solid fa-circle';
}

function state(room) {
  const over = gameOver(room);
  const ids = [...room.players.keys()];
  return {
    room: room.code,
    game: room.game,
    hostId: room.hostId,
    creatorId: room.creatorId || null,
    ready: { ...(room.ready || {}) },
    started: !!room.started,
    picks: { ...(room.picks || {}) },
    duel: { red: ids[0] || null, yellow: ids[1] || null, winnerId: over.winnerId, isDraw: over.isDraw },
    players: [...room.players.values()].map((p) => ({ ...p, bg: bgOfColor(p.color), glyph: glyphOfSymbol(p.symbol), icon: iconOfSymbol(p.symbol) })),
    tictactoe: {
      grid: (room.tictactoe || freshTictactoe()).grid,
      turn: (room.tictactoe || {}).turn || null,
      winCells: (room.tictactoe || {}).winCells || [],
    },
    memory: (() => {
      const m = room.memory || freshMemory();
      const vis = new Set([...(m.flipped || []), ...(m.shown || [])]);
      return {
        faces: Array.from({ length: 16 }, (_, i) => (m.matched[i] || vis.has(i) ? (m.deck || [])[i] || null : null)),
        matched: m.matched || Array(16).fill(null),
        scores: { ...(m.scores || {}) },
        turn: m.turn || null,
      };
    })(),
    bataille: {
      size: BAT_SIZE,
      ships: { ...((room.bataille || {}).ships || {}) },
      fleets: { ...((room.bataille || {}).fleets || {}) },
      shots: { ...((room.bataille || {}).shots || {}) },
      turn: (room.bataille || {}).turn || null,
    },
    uno: {
      hands: { ...((room.uno || {}).hands || {}) },
      top: (((room.uno || {}).pile || []).slice(-1)[0]) || null,
      color: (room.uno || {}).color || null,
      turn: (room.uno || {}).turn || null,
      pendingWild: (room.uno || {}).pendingWild || null,
      counts: Object.fromEntries(Object.entries((room.uno || {}).hands || {}).map(([id, h]) => [id, h.length])),
    },
    connect4: {
      grid: (room.connect4 || freshBoard()).grid,
      turn: (room.connect4 || {}).turn || null,
      winnerId: (room.connect4 || {}).winnerId || null,
      isDraw: !!(room.connect4 || {}).isDraw,
      winCells: (room.connect4 || {}).winCells || [],
      red: [...room.players.keys()][0] || null,
      yellow: [...room.players.keys()][1] || null,
      colorBg: Object.fromEntries(
        [...room.players.keys()].slice(0, 2).map((id) => [id, bgOfColor((room.players.get(id) || {}).color)])
      ),
    },
  };
}

module.exports = {
  rooms,
  generateRoomCode,
  createRoom,
  deleteRoom,
  getRoom,
  setGame,
  setPick,
  resetRound,
  addPlayer,
  removePlayer,
  setPlayerColor,
  setPlayerSymbol,
  setReady,
  tryStart,
  forfeit,
  bataillePlaceManual,
  handleInput,
  gameOver,
  memoryConceal,
  state,
  COLORS,
  SYMBOLS,
  UNO_COLORS,
  BAT_SIZE,
};