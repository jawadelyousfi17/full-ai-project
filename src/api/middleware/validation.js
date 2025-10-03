const fs = require('fs-extra');
const path = require('path');

/**
 * Validation middleware for API requests
 */
class ValidationMiddleware {
  /**
   * Validate script generation request
   */
  static validateScriptGeneration(req, res, next) {
    const { topic, duration, style, audience, tone } = req.body;
    const errors = [];

    // Topic validation
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      errors.push({
        field: 'topic',
        message: 'Topic is required and must be a non-empty string'
      });
    } else if (topic.length > 500) {
      errors.push({
        field: 'topic',
        message: 'Topic must be less than 500 characters'
      });
    }

    // Duration validation
    if (duration !== undefined) {
      if (typeof duration !== 'number' || duration < 1 || duration > 180) {
        errors.push({
          field: 'duration',
          message: 'Duration must be a number between 1 and 180 minutes'
        });
      }
    }

    // Style validation
    const validStyles = ['educational', 'entertaining', 'conversational', 'documentary', 'tutorial'];
    if (style && !validStyles.includes(style)) {
      errors.push({
        field: 'style',
        message: `Style must be one of: ${validStyles.join(', ')}`
      });
    }

    // Audience validation
    const validAudiences = ['general', 'children', 'adults', 'professionals'];
    if (audience && !validAudiences.includes(audience)) {
      errors.push({
        field: 'audience',
        message: `Audience must be one of: ${validAudiences.join(', ')}`
      });
    }

    // Tone validation
    const validTones = ['formal', 'casual', 'friendly', 'professional'];
    if (tone && !validTones.includes(tone)) {
      errors.push({
        field: 'tone',
        message: `Tone must be one of: ${validTones.join(', ')}`
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors
        }
      });
    }

    next();
  }

  /**
   * Validate audio generation request
   */
  static validateAudioGeneration(req, res, next) {
    const { text, file, voice, format, bitrate, latency, chunkLength } = req.body;
    const errors = [];

    // Either text or file must be provided
    if (!text && !file) {
      errors.push({
        field: 'text_or_file',
        message: 'Either text or file parameter must be provided'
      });
    }

    // If both are provided, prefer file
    if (text && file) {
      req.body.text = undefined; // Clear text to use file
    }

    // Text validation
    if (text && (typeof text !== 'string' || text.trim().length === 0)) {
      errors.push({
        field: 'text',
        message: 'Text must be a non-empty string'
      });
    } else if (text && text.length > 200000) {
      errors.push({
        field: 'text',
        message: 'Text must be less than 200,000 characters'
      });
    }

    // File validation
    if (file) {
      if (typeof file !== 'string') {
        errors.push({
          field: 'file',
          message: 'File must be a valid file path string'
        });
      } else {
        const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
          errors.push({
            field: 'file',
            message: 'Specified file does not exist'
          });
        }
      }
    }

    // Format validation
    const validFormats = ['mp3', 'wav', 'flac'];
    if (format && !validFormats.includes(format)) {
      errors.push({
        field: 'format',
        message: `Format must be one of: ${validFormats.join(', ')}`
      });
    }

    // Bitrate validation
    if (bitrate !== undefined) {
      if (typeof bitrate !== 'number' || bitrate < 32 || bitrate > 320) {
        errors.push({
          field: 'bitrate',
          message: 'Bitrate must be a number between 32 and 320'
        });
      }
    }

    // Latency validation
    const validLatencies = ['normal', 'balanced'];
    if (latency && !validLatencies.includes(latency)) {
      errors.push({
        field: 'latency',
        message: `Latency must be one of: ${validLatencies.join(', ')}`
      });
    }

    // Chunk length validation
    if (chunkLength !== undefined) {
      if (typeof chunkLength !== 'number' || chunkLength < 100 || chunkLength > 2000) {
        errors.push({
          field: 'chunkLength',
          message: 'Chunk length must be a number between 100 and 2000'
        });
      }
    }

    // Voice validation (basic format check)
    if (voice && (typeof voice !== 'string' || voice.length < 3)) {
      errors.push({
        field: 'voice',
        message: 'Voice must be a valid voice ID string'
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors
        }
      });
    }

    next();
  }

  /**
   * Validate file operations (download/delete)
   */
  static validateFileOperation(req, res, next) {
    const { type, filename } = req.params;
    const errors = [];

    // Type validation
    const validTypes = ['scripts', 'audio'];
    if (!validTypes.includes(type)) {
      errors.push({
        field: 'type',
        message: `Type must be one of: ${validTypes.join(', ')}`
      });
    }

    // Filename validation
    if (!filename || typeof filename !== 'string') {
      errors.push({
        field: 'filename',
        message: 'Filename is required and must be a string'
      });
    } else {
      // Security check: prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        errors.push({
          field: 'filename',
          message: 'Invalid filename: path traversal not allowed'
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors
        }
      });
    }

    next();
  }

  /**
   * Validate script-to-audio pipeline request
   */
  static validateScriptToAudio(req, res, next) {
    // Combine validations from both script and audio generation
    ValidationMiddleware.validateScriptGeneration(req, res, (err) => {
      if (err) return;
      
      // Create a mock audio request for validation
      const audioReq = {
        body: {
          voice: req.body.voice,
          format: req.body.format,
          bitrate: req.body.bitrate,
          latency: req.body.latency,
          chunkLength: req.body.chunkLength,
          text: 'dummy' // Provide dummy text for validation
        }
      };

      ValidationMiddleware.validateAudioGeneration(audioReq, res, next);
    });
  }

  /**
   * Generic error handler middleware
   */
  static errorHandler(err, req, res, next) {
    console.error('API Error:', err);

    // Handle specific error types
    if (err.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Requested file not found',
          details: err.message
        }
      });
    }

    if (err.code === 'EACCES') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to requested resource',
          details: err.message
        }
      });
    }

    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: err.message
        }
      });
    }

    // Handle API key errors
    if (err.message && err.message.includes('API key')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_ERROR',
          message: 'API key configuration error',
          details: err.message
        }
      });
    }

    // Handle timeout errors
    if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timed out',
          details: 'The operation took too long to complete'
        }
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later'
      }
    });
  }

  /**
   * Request logging middleware
   */
  static requestLogger(req, res, next) {
    const start = Date.now();
    const { method, url, ip } = req;
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      console.log(`${method} ${url} - ${statusCode} - ${duration}ms - ${ip}`);
    });

    next();
  }

  /**
   * Rate limiting middleware (basic implementation)
   */
  static rateLimiter(windowMs = 15 * 60 * 1000, maxRequests = 100) {
    const requests = new Map();

    return (req, res, next) => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old requests
      if (requests.has(clientId)) {
        const clientRequests = requests.get(clientId).filter(time => time > windowStart);
        requests.set(clientId, clientRequests);
      }

      // Check rate limit
      const clientRequests = requests.get(clientId) || [];
      if (clientRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            details: `Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes`
          }
        });
      }

      // Add current request
      clientRequests.push(now);
      requests.set(clientId, clientRequests);

      next();
    };
  }
}

module.exports = ValidationMiddleware;
