const QRCode = require('qrcode');

function joinUrlFor(code, host) {
  const base = process.env.PUBLIC_URL || `http://${host || 'localhost:4444'}`;
  return `${base}/controller?room=${code}`;
}

function roomQr(joinUrl) {
  return QRCode.toDataURL(joinUrl, { width: 220, margin: 1 });
}

module.exports = { joinUrlFor, roomQr };
