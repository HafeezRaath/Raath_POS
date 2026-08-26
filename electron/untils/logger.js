const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { CONFIG } = require('../constants/config');

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
let currentLogLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

class AsyncLogger {
  constructor() {
    this.buffer = [];
    this.flushInterval = CONFIG.logFlushInterval;
    this.maxBufferSize = CONFIG.maxLogBufferSize;
    this.isFlushing = false;
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, `raath-${new Date().toISOString().split('T')[0]}.log`);
    this.lastFlushTime = Date.now();
    this.MAX_BUFFER_SIZE = 1000;

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this.timer = setInterval(() => this.flush(), this.flushInterval);
    process.on('exit', () => this.shutdown());
  }

  log(level, message, data = null) {
    if (level > currentLogLevel) return;

    const redactedData = this._redactSensitiveData(data);

    const entry = {
      timestamp: new Date().toISOString(),
      level: Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'INFO',
      message,
      data: redactedData ? (typeof redactedData === 'object' ? redactedData : { value: redactedData }) : undefined,
      pid: process.pid
    };

    const consoleMsg = `[${entry.timestamp}] [${entry.level}] ${message}`;
    if (level === LOG_LEVELS.ERROR) console.error(consoleMsg);
    else console.log(consoleMsg);
    if (redactedData) console.log(JSON.stringify(redactedData, null, 2));

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
      if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
        this.buffer = this.buffer.slice(-this.MAX_BUFFER_SIZE / 2);
        console.warn('Log buffer truncated due to overflow');
      }
    }

    this.buffer.push(JSON.stringify(entry));
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  _redactSensitiveData(data) {
    if (!data) return data;
    const sensitiveKeys = ['password', 'password_hash', 'token', 'apiKey', 'appPassword', 'cnic', 'email', 'phone'];
    const redacted = { ...data };
    for (const key of sensitiveKeys) {
      if (redacted[key] !== undefined) {
        redacted[key] = '*****';
      }
    }
    return redacted;
  }

  async flush() {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;
    const entries = this.buffer.splice(0, this.buffer.length);
    const content = entries.join('\n') + '\n';
    try {
      await fs.promises.appendFile(this.logFile, content);
      this.lastFlushTime = Date.now();
    } catch (error) {
      console.error('Failed to write logs:', error);
      this.buffer.unshift(...entries);
      if (this.buffer.length > this.MAX_BUFFER_SIZE) {
        this.buffer = this.buffer.slice(-this.MAX_BUFFER_SIZE);
        console.error('Log buffer truncated after flush failure');
      }
    } finally {
      this.isFlushing = false;
    }
  }

  async shutdown() {
    clearInterval(this.timer);
    while (this.isFlushing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await this.flush();
  }
}

const logger = new AsyncLogger();

function log(level, message, data = null) {
  logger.log(level, message, data);
}

module.exports = { LOG_LEVELS, log, logger, currentLogLevel };