const COLORS = [
  { id: 'red', name: 'Rouge', bg: 'bg-red-500' },
  { id: 'yellow', name: 'Jaune', bg: 'bg-yellow-400' },
  { id: 'blue', name: 'Bleu', bg: 'bg-blue-500' },
  { id: 'green', name: 'Vert', bg: 'bg-green-500' },
  { id: 'purple', name: 'Violet', bg: 'bg-purple-500' },
  { id: 'orange', name: 'Orange', bg: 'bg-orange-500' },
  { id: 'pink', name: 'Rose', bg: 'bg-pink-500' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-400' },
  { id: 'lime', name: 'Citron', bg: 'bg-lime-400' },
  { id: 'teal', name: 'Turquoise', bg: 'bg-teal-400' },
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500' },
  { id: 'brown', name: 'Marron', bg: 'bg-amber-800' },
];

const SYMBOLS = [
  { id: 'x', glyph: 'X', icon: 'fa-solid fa-xmark', name: 'Croix' },
  { id: 'o', glyph: 'O', icon: 'fa-solid fa-o', name: 'Rond' },
  { id: 'star', glyph: '★', icon: 'fa-solid fa-star', name: 'Étoile' },
  { id: 'heart', glyph: '♥', icon: 'fa-solid fa-heart', name: 'Cœur' },
  { id: 'tri', glyph: '▲', icon: 'fa-solid fa-play', name: 'Triangle' },
  { id: 'dot', glyph: '●', icon: 'fa-solid fa-circle', name: 'Point' },
  { id: 'moon', glyph: '☾', icon: 'fa-solid fa-moon', name: 'Lune' },
  { id: 'bolt', glyph: '⚡', icon: 'fa-solid fa-bolt', name: 'Éclair' },
  { id: 'diamond', glyph: '◆', icon: 'fa-solid fa-diamond', name: 'Carreau' },
];

const UNO_COLORS = [
  { id: 'r', name: 'Rouge', bg: 'bg-red-500' },
  { id: 'b', name: 'Bleu', bg: 'bg-blue-500' },
  { id: 'g', name: 'Vert', bg: 'bg-green-500' },
  { id: 'y', name: 'Jaune', bg: 'bg-yellow-400' },
];

const MEMO_SYMBOLS = ['★', '♥', '▲', '●', '◆', '■', '♣', '♦'];

const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

const BAT_SIZE = 9;
const BAT_FLEET = [5, 4, 3, 2, 2];

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function bgOfColor(colorId) {
  return (COLORS.find((c) => c.id === colorId) || {}).bg || 'bg-zinc-500';
}

function glyphOfSymbol(symId) {
  return (SYMBOLS.find((s) => s.id === symId) || {}).glyph || '?';
}

function iconOfSymbol(symId) {
  return (SYMBOLS.find((s) => s.id === symId) || {}).icon || 'fa-solid fa-circle';
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = {
  COLORS,
  SYMBOLS,
  UNO_COLORS,
  MEMO_SYMBOLS,
  TTT_LINES,
  BAT_SIZE,
  BAT_FLEET,
  CODE_ALPHABET,
  bgOfColor,
  glyphOfSymbol,
  iconOfSymbol,
  shuffled,
};