const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

class Config {
  constructor() {
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    this.mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-video-generator';
    this.mongodbDbName = process.env.MONGODB_DB_NAME || 'ai-video-generator';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.outputDir = process.env.OUTPUT_DIR || './output';
  }

  validate() {
    const errors = [];
    
    if (!this.getAnthropicApiKey()) {
      errors.push('ANTHROPIC_API_KEY is required. Please set it in your .env file.');
    }

    if (!this.mongodbUri) {
      errors.push('MONGODB_URI is required. Please set it in your .env file.');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    }
  }

  getAnthropicApiKey() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    return key;
  }

  getFishAudioApiKey() {
    const key = process.env.FISH_AUDIO_API_KEY;
    if (!key) {
      throw new Error('FISH_AUDIO_API_KEY environment variable is required for audio generation');
    }
    return key;
  }

  getMongodbUri() {
    return this.mongodbUri;
  }

  getMongodbDbName() {
    return this.mongodbDbName;
  }

  getOutputDir() {
    return path.resolve(this.outputDir);
  }

  getLogLevel() {
    return this.logLevel;
  }
}

module.exports = new Config();
