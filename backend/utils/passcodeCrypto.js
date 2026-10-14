// ============================================================
//  passcodeCrypto — AES-256-GCM encryption for repair job passcodes
//  Key derived from JWT_SECRET so nothing extra needs configuring.
// ============================================================
const crypto = require('crypto');

function getKey() {
  const secret = process.env.JWT_SECRET || 'raath-pos-fallback-secret';
  return crypto.scryptSync(secret, 'raath-pos-passcode-salt', 32);
}

function encryptPasscode(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptPasscode(payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('gcm:')) return null;
  try {
    const [, ivHex, tagHex, encHex] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch (e) {
    return null;
  }
}

module.exports = { encryptPasscode, decryptPasscode };
