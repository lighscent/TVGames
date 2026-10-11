const { MEMO_SYMBOLS, shuffled, firstTurn } = require('./helpers');
const { freshMemory } = require('../registry');

function memoryDeal(room) {
  const m = room.memory;
  m.deck = shuffled([...MEMO_SYMBOLS, ...MEMO_SYMBOLS]);
  m.flipped = [];
  m.shown = [];
  m.shownId = 0;
  m.matched = Array(16).fill(null);
  m.scores = {};
  m.winnerId = null;
  m.isDraw = false;
}

function memoryFlip(room, playerId, idx) {
  room.memory = room.memory || freshMemory();
  const m = room.memory;
  const { red, yellow } = contestants(room);
  if (room.game !== 'memory' || !room.started || !red || !yellow || m.winnerId || m.isDraw || !m.deck.length) return { accepted: false };
  idx = Number(idx);
  if (!Number.isInteger(idx) || idx < 0 || idx > 15 || m.matched[idx] || m.flipped.includes(idx)) return { accepted: false };
  if (playerId !== red && playerId !== yellow) return { accepted: false };
  if (!m.turn) m.turn = firstTurn(room, red, yellow);
  if (m.turn !== playerId) return { accepted: false };
  m.shown = [];
  m.flipped.push(idx);
  m.shownId = (m.shownId || 0) + 1;
  if (m.flipped.length === 2) {
    const [a, b] = m.flipped;
    if (m.deck[a] === m.deck[b]) {
      m.matched[a] = playerId;
      m.matched[b] = playerId;
      m.scores[playerId] = (m.scores[playerId] || 0) + 1;
      m.flipped = [];
      if (m.matched.every(Boolean)) {
        const s = (id) => m.scores[id] || 0;
        if (s(red) === s(yellow)) {
          m.isDraw = true;
          if (room.lastLoser) delete room.lastLoser[room.game];
        } else {
          m.winnerId = s(red) > s(yellow) ? red : yellow;
          room.lastLoser = room.lastLoser || {};
          room.lastLoser[room.game] = m.winnerId === red ? yellow : red;
        }
      }
    } else {
      m.shown = [a, b];
      m.flipped = [];
      m.turn = playerId === red ? yellow : red;
    }
  }
  return { accepted: true };
}

function memoryConceal(room, id) {
  const m = room.memory;
  if (!m || m.shownId !== id || !m.shown.length) return false;
  m.shown = [];
  return true;
}

function contestants(room) {
  const ids = [...room.players.keys()];
  return { red: ids[0] || null, yellow: ids[1] || null };
}

module.exports = { memoryDeal, memoryFlip, memoryConceal, contestants };