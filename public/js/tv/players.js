import { games, S } from './state.js';
import { escapeHtml } from './utils.js';

export const gameLabel = (id) => {
  const g = games.find((gg) => gg.id === id);
  return g ? `<i class="${g.icon}"></i> ${escapeHtml(g.name)}` : escapeHtml(id);
};
export const playerName = (id) => (S.state?.players || []).find((p) => p.id === id)?.name || '?';
export const pdot = (id) => `<span class="inline-block h-[2vmin] w-[2vmin] rounded-full ${((S.state?.players || []).find((p) => p.id === id) || {}).bg || 'bg-zinc-600'}"></span>`;
export const duel = () => (S.state && S.state.duel) || { red: null, yellow: null, winnerId: null, isDraw: false };
export const gameName = (id) => (games.find((gg) => gg.id === id) || {}).name || id;
export const glyphOf = (id) => ((S.state?.players || []).find((p) => p.id === id) || {}).glyph || '?';
export const bgOf = (id) => ((S.state?.players || []).find((p) => p.id === id) || {}).bg || 'bg-zinc-600';
export const iconOf = (id) => ((S.state?.players || []).find((p) => p.id === id) || {}).icon || 'fa-solid fa-circle';
const TEXT_OF = {
  'bg-red-500': 'text-red-500', 'bg-yellow-400': 'text-yellow-400', 'bg-blue-500': 'text-blue-500',
  'bg-green-500': 'text-green-500', 'bg-purple-500': 'text-purple-500', 'bg-orange-500': 'text-orange-500',
  'bg-pink-500': 'text-pink-500', 'bg-cyan-400': 'text-cyan-400', 'bg-lime-400': 'text-lime-400',
  'bg-teal-400': 'text-teal-400', 'bg-indigo-500': 'text-indigo-500', 'bg-amber-800': 'text-amber-500',
};
export const textOf = (bg) => TEXT_OF[bg] || 'text-zinc-500';
export const readyMarkTv = (id) => S.state.ready[id]
  ? '<i class="fa-solid fa-check text-emerald-400"></i>'
  : '<i class="fa-solid fa-hourglass-half text-zinc-500"></i>';
export const preVsTv = () => {
  const d = duel();
  return d.red && d.yellow
    ? `${pdot(d.red)} ${escapeHtml(playerName(d.red))} ${readyMarkTv(d.red)} vs ${pdot(d.yellow)} ${escapeHtml(playerName(d.yellow))} ${readyMarkTv(d.yellow)}`
    : 'En attente de 2 joueurs…';
};
