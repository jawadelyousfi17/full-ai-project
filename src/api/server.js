const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');
const ScriptWriter = require('../services/scriptWriter');
const FishAudioService = require('../services/fishAudio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize services
let scriptWriter;
let fishAudio;

async function initializeServices() {
  try {
    config.validate();
    scriptWriter = new ScriptWriter();
    fishAudio = new FishAudioService();
    logger.info('API services initialized successfully');
    return true;
  } catch (error) {
    logger.error('API service initialization failed:', error.message);
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      scriptWriter: !!scriptWriter,
      fishAudio: !!fishAudio
    }
  });
});

// Generate script endpoint
app.post('/api/generate-script', async (req, res) => {
  try {
    const { 
      topic, 
      duration = 3, 
      style = 'educational', 
      audience = 'general', 
      tone = 'conversational',
      referenceFile 
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    logger.info(`API: Generating script for "${topic}"`);
    
    const scriptData = await scriptWriter.generatePlainTextScript(topic, {
      duration: parseInt(duration),
      style,
      audience,
      tone,
      referenceFile
    });

    res.json({
      success: true,
      data: {
        topic,
        content: scriptData.content,
        filePath: scriptData.filePath,
        wordCount: scriptData.wordCount,
        estimatedDuration: scriptData.estimatedDuration,
        generatedAt: scriptData.generatedAt
      }
    });

  } catch (error) {
    logger.error('API script generation error:', error.message);
    res.status(500).json({ 
      error: 'Script generation failed', 
      message: error.message 
    });
  }
});

// Generate audio endpoint
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { 
      text, 
      filePath,
      format = 'mp3',
      voice,
      chunkLength = 500,
      bitrate = 128000,
      latency = 'balanced'
    } = req.body;

    if (!text && !filePath) {
      return res.status(400).json({ error: 'Either text or filePath is required' });
    }

    logger.info('API: Generating audio');

    let result;
    if (filePath) {
      // Generate from file
      const audioOptions = {
        format,
        referenceId: voice === 'default' ? null : voice,
        chunkSize: parseInt(chunkLength) * 20,
        mp3Bitrate: parseInt(bitrate) / 1000,
        latency,
        outputDir: './output/audio'
      };
      
      result = await fishAudio.generateAudioFromScript(filePath, audioOptions);
    } else {
      // Generate from text (create temp file)
      const fs = require('fs-extra');
      const tempDir = './output/temp';
      await fs.ensureDir(tempDir);
      
      const tempFile = path.join(tempDir, `temp-${Date.now()}.txt`);
      await fs.writeFile(tempFile, text);
      
      const audioOptions = {
        format,
        referenceId: voice === 'default' ? null : voice,
        chunkSize: parseInt(chunkLength) * 20,
        mp3Bitrate: parseInt(bitrate) / 1000,
        latency,
        outputDir: './output/audio'
      };
      
      result = await fishAudio.generateAudioFromScript(tempFile, audioOptions);
      
      // Clean up temp file
      await fs.remove(tempFile);
    }

    res.json({
      success: true,
      data: {
        outputPath: result.outputPath,
        fileSize: result.fileSize,
        estimatedDuration: result.estimatedDuration,
        format,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('API audio generation error:', error.message);
    res.status(500).json({ 
      error: 'Audio generation failed', 
      message: error.message 
    });
  }
});

// Complete pipeline endpoint
app.post('/api/script-to-audio', async (req, res) => {
  try {
    const { 
      topic,
      duration = 3,
      style = 'educational',
      audience = 'general',
      tone = 'conversational',
      format = 'mp3',
      voice,
      preview = false
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    logger.info(`API: Starting script-to-audio pipeline for "${topic}"`);

    // Step 1: Generate script
    const scriptOptions = {
      duration: parseInt(duration),
      style,
      audience,
      tone
    };

    let scriptData;
    if (preview) {
      const previewData = await scriptWriter.generateScriptPreview(topic, scriptOptions);
      scriptData = await scriptWriter.generateScriptFromPreview(previewData, scriptOptions);
    } else {
      scriptData = await scriptWriter.generatePlainTextScript(topic, scriptOptions);
    }

    // Step 2: Generate audio
    const audioOptions = {
      format,
      referenceId: voice === 'default' ? null : voice,
      chunkSize: 4000,
      mp3Bitrate: 128,
      latency: 'balanced',
      outputDir: './output/audio',
      filename: `${topic.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().replace(/[:.]/g, '-')}`
    };

    const audioResult = await fishAudio.generateAudioFromScript(scriptData.filePath, audioOptions);

    res.json({
      success: true,
      data: {
        script: {
          topic,
          content: scriptData.content,
          filePath: scriptData.filePath,
          wordCount: scriptData.wordCount,
          estimatedDuration: scriptData.estimatedDuration
        },
        audio: {
          outputPath: audioResult.outputPath,
          fileSize: audioResult.fileSize,
          estimatedDuration: audioResult.estimatedDuration,
          format
        },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('API pipeline error:', error.message);
    res.status(500).json({ 
      error: 'Pipeline failed', 
      message: error.message 
    });
  }
});

// List generated files endpoint
app.get('/api/files', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const { type = 'all' } = req.query;

    const files = {
      scripts: [],
      audio: []
    };

    // List script files
    if (type === 'all' || type === 'scripts') {
      const scriptsDir = './output/scripts';
      if (await fs.pathExists(scriptsDir)) {
        const scriptFiles = await fs.readdir(scriptsDir);
        for (const file of scriptFiles) {
          const filePath = path.join(scriptsDir, file);
          const stats = await fs.stat(filePath);
          files.scripts.push({
            name: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      }
    }

    // List audio files
    if (type === 'all' || type === 'audio') {
      const audioDir = './output/audio';
      if (await fs.pathExists(audioDir)) {
        const audioFiles = await fs.readdir(audioDir);
        for (const file of audioFiles) {
          const filePath = path.join(audioDir, file);
          const stats = await fs.stat(filePath);
          files.audio.push({
            name: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      }
    }

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    logger.error('API file listing error:', error.message);
    res.status(500).json({ 
      error: 'Failed to list files', 
      message: error.message 
    });
  }
});

// Download file endpoint
app.get('/api/download/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params;
    
    let filePath;
    if (type === 'script') {
      filePath = path.join('./output/scripts', filename);
    } else if (type === 'audio') {
      filePath = path.join('./output/audio', filename);
    } else {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Security check - ensure file is within allowed directories
    const resolvedPath = path.resolve(filePath);
    const allowedDir = path.resolve(`./output/${type === 'script' ? 'scripts' : 'audio'}`);
    
    if (!resolvedPath.startsWith(allowedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.download(resolvedPath, (err) => {
      if (err) {
        logger.error('File download error:', err.message);
        res.status(404).json({ error: 'File not found' });
      }
    });

  } catch (error) {
    logger.error('API download error:', error.message);
    res.status(500).json({ 
      error: 'Download failed', 
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled API error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  const initialized = await initializeServices();
  if (!initialized) {
    logger.error('Failed to initialize services. Exiting...');
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`🚀 AI Video Generation API running on port ${PORT}`);
    logger.info(`📖 Health check: http://localhost:${PORT}/health`);
    logger.info(`🎬 Script generation: POST http://localhost:${PORT}/api/generate-script`);
    logger.info(`🎵 Audio generation: POST http://localhost:${PORT}/api/generate-audio`);
    logger.info(`⚡ Full pipeline: POST http://localhost:${PORT}/api/script-to-audio`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down API server...');
  process.exit(0);
});

module.exports = { app, startServer };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
