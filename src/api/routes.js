const express = require('express');
const router = express.Router();
const ScriptWriter = require('../services/scriptWriter');
const FishAudioService = require('../services/fishAudio');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs-extra');

// Initialize services (will be set by server.js)
let scriptWriter;
let fishAudio;

function setServices(sw, fa) {
  scriptWriter = sw;
  fishAudio = fa;
}

// API Documentation endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'AI Video Generation API',
    version: '1.0.0',
    description: 'REST API for script generation and text-to-speech conversion',
    endpoints: {
      'GET /health': 'Health check',
      'POST /api/generate-script': 'Generate script from topic',
      'POST /api/generate-audio': 'Convert text/file to audio',
      'POST /api/script-to-audio': 'Complete pipeline: topic → script → audio',
      'GET /api/files': 'List generated files',
      'GET /api/download/:type/:filename': 'Download files'
    },
    examples: {
      generateScript: {
        url: 'POST /api/generate-script',
        body: {
          topic: 'How to make coffee',
          duration: 3,
          style: 'educational',
          audience: 'general',
          tone: 'conversational'
        }
      },
      generateAudio: {
        url: 'POST /api/generate-audio',
        body: {
          text: 'Hello world, this is a test.',
          format: 'mp3',
          voice: '090623498e9843068d8507db5a700f90'
        }
      },
      scriptToAudio: {
        url: 'POST /api/script-to-audio',
        body: {
          topic: 'Benefits of meditation',
          duration: 5,
          style: 'educational',
          format: 'mp3'
        }
      }
    }
  });
});

// Generate script preview endpoint
router.post('/generate-preview', async (req, res) => {
  try {
    const { 
      topic, 
      duration = 3, 
      style = 'educational', 
      audience = 'general', 
      tone = 'conversational'
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    logger.info(`API: Generating preview for "${topic}"`);
    
    const previewData = await scriptWriter.generateScriptPreview(topic, {
      duration: parseInt(duration),
      style,
      audience,
      tone
    });

    res.json({
      success: true,
      data: {
        topic,
        title: previewData.title,
        chapters: previewData.chapters,
        estimatedDuration: previewData.estimatedDuration,
        wordCountTarget: previewData.wordCountTarget,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('API preview generation error:', error.message);
    res.status(500).json({ 
      error: 'Preview generation failed', 
      message: error.message 
    });
  }
});

// Generate script from preview endpoint
router.post('/generate-from-preview', async (req, res) => {
  try {
    const { previewData, options = {} } = req.body;

    if (!previewData) {
      return res.status(400).json({ error: 'Preview data is required' });
    }

    logger.info(`API: Generating script from preview`);
    
    const scriptData = await scriptWriter.generateScriptFromPreview(previewData, options);

    res.json({
      success: true,
      data: {
        content: scriptData.content,
        filePath: scriptData.filePath,
        wordCount: scriptData.wordCount,
        estimatedDuration: scriptData.estimatedDuration,
        generatedAt: scriptData.generatedAt
      }
    });

  } catch (error) {
    logger.error('API script from preview error:', error.message);
    res.status(500).json({ 
      error: 'Script generation from preview failed', 
      message: error.message 
    });
  }
});

// Get available voices endpoint
router.get('/voices', async (req, res) => {
  try {
    const voices = await fishAudio.listAvailableVoices();
    
    res.json({
      success: true,
      data: {
        defaultVoices: voices.defaultVoices,
        customVoice: '090623498e9843068d8507db5a700f90',
        currentModel: 's1'
      }
    });

  } catch (error) {
    logger.error('API voices listing error:', error.message);
    res.status(500).json({ 
      error: 'Failed to list voices', 
      message: error.message 
    });
  }
});

// Batch processing endpoint
router.post('/batch-process', async (req, res) => {
  try {
    const { topics, options = {} } = req.body;

    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: 'Topics array is required' });
    }

    if (topics.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 topics allowed per batch' });
    }

    logger.info(`API: Processing batch of ${topics.length} topics`);
    
    const results = [];
    const errors = [];

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      try {
        logger.info(`Processing batch item ${i + 1}/${topics.length}: "${topic}"`);
        
        // Generate script
        const scriptData = await scriptWriter.generatePlainTextScript(topic, options);
        
        // Generate audio
        const audioOptions = {
          format: options.format || 'mp3',
          referenceId: options.voice === 'default' ? null : options.voice,
          chunkSize: 4000,
          mp3Bitrate: 128,
          latency: 'balanced',
          outputDir: './output/audio',
          filename: `batch-${i + 1}-${topic.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`
        };
        
        const audioResult = await fishAudio.generateAudioFromScript(scriptData.filePath, audioOptions);
        
        results.push({
          topic,
          success: true,
          script: {
            filePath: scriptData.filePath,
            wordCount: scriptData.wordCount,
            estimatedDuration: scriptData.estimatedDuration
          },
          audio: {
            outputPath: audioResult.outputPath,
            fileSize: audioResult.fileSize,
            estimatedDuration: audioResult.estimatedDuration
          }
        });
        
      } catch (error) {
        logger.error(`Batch processing error for topic "${topic}":`, error.message);
        errors.push({
          topic,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        processed: results.length,
        failed: errors.length,
        results,
        errors,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('API batch processing error:', error.message);
    res.status(500).json({ 
      error: 'Batch processing failed', 
      message: error.message 
    });
  }
});

// Delete file endpoint
router.delete('/files/:type/:filename', async (req, res) => {
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

    // Security check
    const resolvedPath = path.resolve(filePath);
    const allowedDir = path.resolve(`./output/${type === 'script' ? 'scripts' : 'audio'}`);
    
    if (!resolvedPath.startsWith(allowedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (await fs.pathExists(resolvedPath)) {
      await fs.remove(resolvedPath);
      logger.info(`Deleted file: ${resolvedPath}`);
      
      res.json({
        success: true,
        message: `File ${filename} deleted successfully`
      });
    } else {
      res.status(404).json({ error: 'File not found' });
    }

  } catch (error) {
    logger.error('API file deletion error:', error.message);
    res.status(500).json({ 
      error: 'File deletion failed', 
      message: error.message 
    });
  }
});

// Statistics endpoint
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      scripts: { count: 0, totalSize: 0 },
      audio: { count: 0, totalSize: 0 },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    // Count script files
    const scriptsDir = './output/scripts';
    if (await fs.pathExists(scriptsDir)) {
      const scriptFiles = await fs.readdir(scriptsDir);
      stats.scripts.count = scriptFiles.length;
      
      for (const file of scriptFiles) {
        const filePath = path.join(scriptsDir, file);
        const stat = await fs.stat(filePath);
        stats.scripts.totalSize += stat.size;
      }
    }

    // Count audio files
    const audioDir = './output/audio';
    if (await fs.pathExists(audioDir)) {
      const audioFiles = await fs.readdir(audioDir);
      stats.audio.count = audioFiles.length;
      
      for (const file of audioFiles) {
        const filePath = path.join(audioDir, file);
        const stat = await fs.stat(filePath);
        stats.audio.totalSize += stat.size;
      }
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('API stats error:', error.message);
    res.status(500).json({ 
      error: 'Failed to get statistics', 
      message: error.message 
    });
  }
});

module.exports = { router, setServices };
