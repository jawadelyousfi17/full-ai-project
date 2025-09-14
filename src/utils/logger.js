const chalk = require('chalk');
const config = require('./config');

class Logger {
  constructor() {
    this.logLevel = config.getLogLevel();
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.log(chalk.blue('ℹ'), message, ...args);
    }
  }

  success(message, ...args) {
    if (this.shouldLog('info')) {
      console.log(chalk.green('✓'), message, ...args);
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.log(chalk.yellow('⚠'), message, ...args);
    }
  }

  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.log(chalk.red('✗'), message, ...args);
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.log(chalk.gray('🐛'), message, ...args);
    }
  }

  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.logLevel];
  }

  spinner(text) {
    const ora = require('ora');
    return ora(text).start();
  }
}

module.exports = new Logger();
