const { CONFIG } = require('../constants/config');

const loginAttempts = new Map();

function checkLoginRate(email) {
  const now = Date.now();
  const attempts = loginAttempts.get(email) || [];
  const recent = attempts.filter(t => now - t < CONFIG.loginWindowMinutes * 60000);
  if (recent.length >= CONFIG.maxLoginAttempts) {
    const waitTime = CONFIG.loginWindowMinutes * 60000 - (now - recent[0]);
    return { allowed: false, waitTime: Math.ceil(waitTime / 60000) };
  }
  return { allowed: true };
}

function recordLoginAttempt(email, success = false) {
  const now = Date.now();
  const attempts = loginAttempts.get(email) || [];
  attempts.push(now);
  loginAttempts.set(email, attempts.filter(t => now - t < CONFIG.loginWindowMinutes * 60000));
  if (success) {
    loginAttempts.delete(email);
  }
}

module.exports = { checkLoginRate, recordLoginAttempt };

