const config = require('./utils/config');
const logger = require('./utils/logger');
const ScriptWriter = require('./services/scriptWriter');

// Main application entry point
class AIVideoGenerator {
  constructor() {
    this.scriptWriter = null;
  }

  async initialize() {
    try {
      config.validate();
      this.scriptWriter = new ScriptWriter();
      logger.success('AI Video Generator initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize:', error.message);
      return false;
    }
  }

  async generateScript(topic, options = {}) {
    if (!this.scriptWriter) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    return await this.scriptWriter.generateScript(topic, options);
  }

  async listScripts() {
    if (!this.scriptWriter) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    return await this.scriptWriter.listScripts();
  }
}

module.exports = AIVideoGenerator;
