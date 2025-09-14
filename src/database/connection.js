const mongoose = require('mongoose');
const config = require('../utils/config');
const logger = require('../utils/logger');

class DatabaseConnection {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected) {
        return this.connection;
      }

      const mongoUri = config.getMongodbUri();
      
      // Connection options
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false
      };

      logger.info('Connecting to MongoDB...');
      
      this.connection = await mongoose.connect(mongoUri, options);
      this.isConnected = true;

      // Connection event listeners
      mongoose.connection.on('connected', () => {
        logger.success('MongoDB connected successfully');
      });

      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err.message);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

      return this.connection;
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.connection.close();
        this.isConnected = false;
        logger.info('MongoDB connection closed');
      }
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error.message);
    }
  }

  getConnection() {
    return this.connection;
  }

  isConnectionActive() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  async ensureConnection() {
    if (!this.isConnectionActive()) {
      await this.connect();
    }
    return this.connection;
  }
}

module.exports = new DatabaseConnection();
