const GAMES = [
  { id: 'lobby', name: 'Lobby', icon: 'fa-solid fa-gamepad', description: 'Salle d’attente, connexion des joueurs.' },
  { id: 'puissance4', name: 'Puissance 4', icon: 'fa-solid fa-circle', description: 'Aligne 4 jetons, les 2 premiers joueurs s’affrontent.', players: '2 joueurs' },
  { id: 'tictactoe', name: 'Morpion', icon: 'fa-solid fa-xmarks-lines', description: 'Aligne 3 symboles, chacun choisit le sien.', players: '2 joueurs' },
  { id: 'memory', name: 'Memory', icon: 'fa-solid fa-clone', description: 'Retrouve les 8 paires, meilleure mémoire gagne.', players: '2 joueurs' },
  { id: 'bataille', name: 'Bataille navale', icon: 'fa-solid fa-ship', description: 'Coule la flotte adverse, placement auto + tirs au tour par tour.', players: '2 joueurs' },
  { id: 'uno', name: 'Uno', icon: 'fa-solid fa-layer-group', description: 'Vide ta main en premier, version simplifiée.', players: '2 joueurs' },
];

function isValidGame(id) {
  return GAMES.some((g) => g.id === id);
}

function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}

module.exports = { GAMES, isValidGame, getGame };
