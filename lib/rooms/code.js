const { CODE_ALPHABET } = require('./constants');

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (require('./registry').rooms.has(code));
  return code;
}

module.exports = { generateRoomCode };