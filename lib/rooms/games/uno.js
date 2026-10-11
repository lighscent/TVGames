const { UNO_COLORS, shuffled, firstTurn } = require('./helpers');
const { freshUno } = require('../registry');

function unoBuildDeck() {
  const deck = [];
  let n = 0;
  for (const c of UNO_COLORS) {
    deck.push({ id: `c${n++}`, color: c.id, kind: 'num', value: 0 });
    for (let v = 1; v <= 9; v++) {
      deck.push({ id: `c${n++}`, color: c.id, kind: 'num', value: v });
      deck.push({ id: `c${n++}`, color: c.id, kind: 'num', value: v });
    }
    for (const kind of ['block', '+2', 'reverse']) {
      deck.push({ id: `c${n++}`, color: c.id, kind });
      deck.push({ id: `c${n++}`, color: c.id, kind });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ id: `c${n++}`, color: null, kind: '+4' });
  return shuffled(deck);
}

function unoDeal(room, red, yellow) {
  const u = room.uno;
  u.deck = unoBuildDeck();
  u.hands = { [red]: u.deck.splice(0, 7), [yellow]: u.deck.splice(0, 7) };
  let top = u.deck.pop();
  while (top.kind !== 'num') { u.deck.unshift(top); top = u.deck.pop(); }
  u.pile = [top];
  u.color = top.color;
  u.pendingWild = null;
  u.winnerId = null;
}

function unoTop(room) {
  const p = room.uno.pile;
  return p[p.length - 1];
}

function unoPlayable(card, top, color) {
  if (card.kind === '+4') return true;
  if (card.color === color) return true;
  if (card.kind === 'num' && top.kind === 'num' && card.value === top.value) return true;
  if (card.kind !== 'num' && card.kind === top.kind) return true;
  return false;
}

function unoDrawCard(room) {
  const u = room.uno;
  if (!u.deck.length) {
    const top = u.pile.pop();
    u.deck = shuffled(u.pile);
    u.pile = [top];
  }
  return u.deck.pop();
}

function unoPlay(room, playerId, cardId) {
  room.uno = room.uno || freshUno();
  const u = room.uno;
  const { red, yellow } = contestants(room);
  if (room.game !== 'uno' || !room.started || !red || !yellow || u.winnerId || u.pendingWild) return { accepted: false };
  if (playerId !== red && playerId !== yellow) return { accepted: false };
  if (!u.turn) u.turn = firstTurn(room, red, yellow);
  if (u.turn !== playerId) return { accepted: false };
  const hand = u.hands[playerId] || [];
  const i = hand.findIndex((c) => c.id === cardId);
  if (i === -1) return { accepted: false };
  const top = unoTop(room);
  if (!unoPlayable(hand[i], top, u.color)) return { accepted: false };
  const [card] = hand.splice(i, 1);
  u.pile.push(card);
  const foe = playerId === red ? yellow : red;
  if (card.kind === '+4') {
    u.hands[foe].push(unoDrawCard(room), unoDrawCard(room), unoDrawCard(room), unoDrawCard(room));
    u.color = null;
    u.pendingWild = playerId;
  } else {
    u.color = card.color;
    if (card.kind === '+2') { u.hands[foe].push(unoDrawCard(room), unoDrawCard(room)); }
    else if (card.kind !== 'block') { u.turn = foe; }
  }
  if (!hand.length) {
    u.winnerId = playerId;
    u.pendingWild = null;
    room.lastLoser = room.lastLoser || {};
    room.lastLoser[room.game] = foe;
  }
  return { accepted: true };
}

function unoColor(room, playerId, colorId) {
  const u = room.uno || freshUno();
  room.uno = u;
  if (room.game !== 'uno' || !room.started || u.winnerId || u.pendingWild !== playerId) return { accepted: false };
  if (!UNO_COLORS.some((c) => c.id === colorId)) return { accepted: false };
  const { red, yellow } = contestants(room);
  u.color = colorId;
  u.pendingWild = null;
  u.turn = playerId === red ? yellow : red;
  return { accepted: true };
}

function unoDraw(room, playerId) {
  room.uno = room.uno || freshUno();
  const u = room.uno;
  const { red, yellow } = contestants(room);
  if (room.game !== 'uno' || !room.started || !red || !yellow || u.winnerId || u.pendingWild) return { accepted: false };
  if (playerId !== red && playerId !== yellow) return { accepted: false };
  if (!u.turn) u.turn = firstTurn(room, red, yellow);
  if (u.turn !== playerId) return { accepted: false };
  const drawn = unoDrawCard(room);
  (u.hands[playerId] = u.hands[playerId] || []).push(drawn);
  const foe = playerId === red ? yellow : red;
  // Main gardée seulement si la carte piochée est jouable, sinon le tour passe
  u.turn = unoPlayable(drawn, unoTop(room), u.color) ? playerId : foe;
  return { accepted: true };
}

function unoPass(room, playerId) {
  room.uno = room.uno || freshUno();
  const u = room.uno;
  const { red, yellow } = contestants(room);
  if (room.game !== 'uno' || !room.started || !red || !yellow || u.winnerId || u.pendingWild) return { accepted: false };
  if (playerId !== red && playerId !== yellow) return { accepted: false };
  if (!u.turn) u.turn = firstTurn(room, red, yellow);
  if (u.turn !== playerId) return { accepted: false };
  u.turn = playerId === red ? yellow : red;
  return { accepted: true };
}

function contestants(room) {
  const ids = [...room.players.keys()];
  return { red: ids[0] || null, yellow: ids[1] || null };
}

module.exports = { unoBuildDeck, unoDeal, unoTop, unoPlayable, unoDrawCard, unoPlay, unoColor, unoDraw, unoPass, contestants };