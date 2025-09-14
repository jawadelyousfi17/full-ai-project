const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const ValidationMiddleware = require('./middleware/validation');
const logger = require('../utils/logger');

// Import services directly
const ScriptWriter = require('../services/scriptWriter');
const FishAudio = require('../services/fishAudio');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const scriptWriter = new ScriptWriter();
const fishAudio = new FishAudio();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(ValidationMiddleware.requestLogger);
app.use(ValidationMiddleware.rateLimiter());

logger.info('API services initialized successfully');

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
app.post('/api/generate-script', ValidationMiddleware.validateScriptGeneration, async (req, res) => {
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

// In-memory job tracking
const activeJobs = new Map();

// Generate audio endpoint with job tracking and streaming support
app.post('/api/generate-audio', ValidationMiddleware.validateAudioGeneration, async (req, res) => {
  try {
    const { 
      text, 
      file,
      format = 'mp3',
      voice,
      chunkLength = 4000,
      bitrate = 128000,
      latency = 'balanced',
      jobId = null
    } = req.body;

    if (!text && !file) {
      return res.status(400).json({ error: 'Either text or file is required' });
    }

    // Generate unique job ID if not provided
    const currentJobId = jobId || `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if client wants streaming updates
    const isStreaming = req.headers.accept === 'text/event-stream';

    if (isStreaming) {
      // Set up Server-Sent Events for progress updates
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Initialize job tracking
      const jobData = {
        id: currentJobId,
        status: 'starting',
        progress: 0,
        startTime: new Date(),
        lastUpdate: new Date(),
        result: null,
        error: null
      };
      activeJobs.set(currentJobId, jobData);

      const sendProgress = (data) => {
        // Update job tracking
        jobData.lastUpdate = new Date();
        jobData.progress = data.progress || jobData.progress;
        jobData.status = data.type;

        // Send to client with job ID
        const progressWithJobId = { ...data, jobId: currentJobId };
        res.write(`data: ${JSON.stringify(progressWithJobId)}\n\n`);
      };

      // Handle client disconnect
      req.on('close', () => {
        logger.info(`Client disconnected from job ${currentJobId}, but job continues running`);
        // Job continues in background
      });

      try {
        let audioResult;
        
        if (file) {
          const filePath = path.join('./output/scripts', file);
          audioResult = await fishAudio.generateAudioFromScriptWithProgress(filePath, {
            format,
            referenceId: voice,
            chunkSize: chunkLength,
            onProgress: sendProgress
          });
        } else {
          const tempDir = path.join('./output/temp');
          await fs.ensureDir(tempDir);
          
          const tempFile = path.join(tempDir, `temp_${Date.now()}.txt`);
          await fs.writeFile(tempFile, text);
          
          audioResult = await fishAudio.generateAudioFromScriptWithProgress(tempFile, {
            format,
            referenceId: voice,
            chunkSize: chunkLength,
            onProgress: sendProgress
          });
          
          await fs.remove(tempFile);
        }

        // Update job with final result
        jobData.status = 'complete';
        jobData.progress = 100;
        jobData.result = audioResult;
        jobData.completedAt = new Date();

        sendProgress({
          type: 'complete',
          jobId: currentJobId,
          data: {
            outputPath: audioResult.outputPath,
            fileSize: audioResult.fileSize,
            estimatedDuration: audioResult.estimatedDuration,
            format,
            generatedAt: new Date().toISOString()
          }
        });

        res.end();
      } catch (error) {
        // Update job with error
        jobData.status = 'error';
        jobData.error = error.message;
        jobData.completedAt = new Date();

        sendProgress({
          type: 'error',
          jobId: currentJobId,
          error: error.message
        });
        res.end();
      }
      return;
    }

    // Regular JSON response for non-streaming requests
    logger.info('API: Generating audio');
    let audioResult;
    
    if (file) {
      const filePath = path.join('./output/scripts', file);
      audioResult = await fishAudio.generateAudioFromScript(filePath, {
        format,
        referenceId: voice,
        chunkSize: chunkLength
      });
    } else {
      const tempDir = path.join('./output/temp');
      await fs.ensureDir(tempDir);
      
      const tempFile = path.join(tempDir, `temp_${Date.now()}.txt`);
      await fs.writeFile(tempFile, text);
      
      audioResult = await fishAudio.generateAudioFromScript(tempFile, {
        format,
        referenceId: voice,
        chunkSize: chunkLength
      });
      
      await fs.remove(tempFile);
    }

    res.json({
      success: true,
      data: {
        outputPath: audioResult.outputPath,
        fileSize: audioResult.fileSize,
        estimatedDuration: audioResult.estimatedDuration,
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

// Job status endpoint for reconnection
app.get('/api/job-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ 
      error: 'Job not found',
      message: 'Job may have expired or never existed'
    });
  }

  res.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      startTime: job.startTime,
      lastUpdate: job.lastUpdate,
      completedAt: job.completedAt,
      result: job.result,
      error: job.error,
      isComplete: job.status === 'complete' || job.status === 'error'
    }
  });
});

// Cleanup old jobs (run every 30 minutes)
setInterval(() => {
  const now = new Date();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [jobId, job] of activeJobs.entries()) {
    const age = now - job.lastUpdate;
    if (age > maxAge) {
      activeJobs.delete(jobId);
      logger.info(`Cleaned up expired job: ${jobId}`);
    }
  }
}, 30 * 60 * 1000);

// Complete pipeline endpoint with job tracking and streaming support
app.post('/api/script-to-audio', ValidationMiddleware.validateScriptToAudio, async (req, res) => {
  try {
    const { 
      topic,
      duration = 3,
      style = 'educational',
      audience = 'general',
      tone = 'conversational',
      format = 'mp3',
      voice,
      preview = false,
      jobId = null
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Generate unique job ID if not provided
    const currentJobId = jobId || `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if client wants streaming updates
    const isStreaming = req.headers.accept === 'text/event-stream';

    if (isStreaming) {
      // Set up Server-Sent Events for progress updates
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Initialize job tracking
      const jobData = {
        id: currentJobId,
        status: 'starting',
        progress: 0,
        startTime: new Date(),
        lastUpdate: new Date(),
        result: null,
        error: null,
        type: 'pipeline'
      };
      activeJobs.set(currentJobId, jobData);

      const sendProgress = (data) => {
        // Update job tracking
        jobData.lastUpdate = new Date();
        jobData.progress = data.progress || jobData.progress;
        jobData.status = data.type;

        // Send to client with job ID
        const progressWithJobId = { ...data, jobId: currentJobId };
        res.write(`data: ${JSON.stringify(progressWithJobId)}\n\n`);
      };

      // Handle client disconnect
      req.on('close', () => {
        logger.info(`Client disconnected from pipeline job ${currentJobId}, but job continues running`);
        // Job continues in background
      });

      try {
        logger.info(`API: Starting script-to-audio pipeline for "${topic}"`);

        // Send initial progress
        sendProgress({
          type: 'pipeline_start',
          message: 'Starting script generation...',
          progress: 0
        });

        // Step 1: Generate script
        const scriptOptions = {
          duration: parseInt(duration),
          style,
          audience,
          tone
        };

        sendProgress({
          type: 'script_generation',
          message: 'Generating script content...',
          progress: 10
        });

        let scriptData;
        if (preview) {
          const previewData = await scriptWriter.generateScriptPreview(topic, scriptOptions);
          scriptData = await scriptWriter.generateScriptFromPreview(previewData, scriptOptions);
        } else {
          scriptData = await scriptWriter.generatePlainTextScript(topic, scriptOptions);
        }

        sendProgress({
          type: 'script_complete',
          message: 'Script generated successfully',
          progress: 50,
          scriptData: {
            wordCount: scriptData.wordCount,
            estimatedDuration: scriptData.estimatedDuration
          }
        });

        // Step 2: Generate audio
        sendProgress({
          type: 'audio_start',
          message: 'Starting audio generation...',
          progress: 55
        });

        const audioOptions = {
          format,
          referenceId: voice === 'default' ? null : voice,
          chunkSize: 4000,
          mp3Bitrate: 128,
          latency: 'balanced',
          outputDir: './output/audio',
          filename: `${topic.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
          onProgress: (audioProgress) => {
            // Map audio progress to overall pipeline progress (55-95%)
            const overallProgress = 55 + (audioProgress.progress || 0) * 0.4;
            sendProgress({
              type: 'audio_progress',
              message: audioProgress.message || 'Generating audio...',
              progress: Math.round(overallProgress),
              audioProgress
            });
          }
        };

        const audioResult = await fishAudio.generateAudioFromScriptWithProgress(scriptData.filePath, audioOptions);

        // Update job with final result
        const finalResult = {
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
        };

        jobData.status = 'complete';
        jobData.progress = 100;
        jobData.result = finalResult;
        jobData.completedAt = new Date();

        sendProgress({
          type: 'complete',
          jobId: currentJobId,
          progress: 100,
          data: finalResult
        });

        res.end();
      } catch (error) {
        // Update job with error
        jobData.status = 'error';
        jobData.error = error.message;
        jobData.completedAt = new Date();

        sendProgress({
          type: 'error',
          jobId: currentJobId,
          error: error.message
        });
        res.end();
      }
      return;
    }

    // Regular JSON response for non-streaming requests
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
app.get('/api/download/:type/:filename', ValidationMiddleware.validateFileOperation, async (req, res) => {
  try {
    const { type, filename } = req.params;
    const fs = require('fs-extra');
    
    let filePath;
    if (type === 'scripts') {
      filePath = path.join('./output/scripts', filename);
    } else if (type === 'audio') {
      filePath = path.join('./output/audio', filename);
    } else {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Security check - ensure file is within allowed directories
    const resolvedPath = path.resolve(filePath);
    const allowedDir = path.resolve(`./output/${type === 'scripts' ? 'scripts' : 'audio'}`);
    
    if (!resolvedPath.startsWith(allowedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    const fileExists = await fs.pathExists(resolvedPath);
    if (!fileExists) {
      logger.error(`File not found: ${resolvedPath}`);
      return res.status(404).json({ error: 'File not found', path: resolvedPath });
    }

    // Read file and send as response
    const fileContent = await fs.readFile(resolvedPath);
    const mimeType = type === 'scripts' ? 'text/plain' : 'audio/wav';
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mimeType);
    res.send(fileContent);

  } catch (error) {
    logger.error('API download error:', error.message);
    res.status(500).json({ 
      error: 'Download failed', 
      message: error.message 
    });
  }
});

// Delete file endpoint
app.delete('/api/delete/:type/:filename', ValidationMiddleware.validateFileOperation, async (req, res) => {
  try {
    const { type, filename } = req.params;
    const fs = require('fs-extra');
    
    let filePath;
    if (type === 'scripts') {
      filePath = path.join('./output/scripts', filename);
    } else if (type === 'audio') {
      filePath = path.join('./output/audio', filename);
    } else {
      return res.status(400).json({ 
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Invalid file type. Must be "scripts" or "audio"'
        }
      });
    }

    // Security check - ensure file is within allowed directories
    const resolvedPath = path.resolve(filePath);
    const allowedDir = path.resolve(`./output/${type}`);
    
    if (!resolvedPath.startsWith(allowedDir)) {
      return res.status(403).json({ 
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to requested file'
        }
      });
    }

    // Check if file exists
    if (!(await fs.pathExists(resolvedPath))) {
      return res.status(404).json({ 
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found'
        }
      });
    }

    // Delete the file
    await fs.remove(resolvedPath);
    
    res.json({
      success: true,
      message: 'File deleted successfully',
      deletedFile: filename
    });

  } catch (error) {
    logger.error('API delete error:', error.message);
    res.status(500).json({ 
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete file',
        details: error.message
      }
    });
  }
});

// Get available voices endpoint
app.get('/api/voices', (req, res) => {
  try {
    // For now, return the default voice configuration
    // This could be expanded to query FishAudio API for available voices
    res.json({
      success: true,
      data: {
        voices: [
          {
            id: '090623498e9843068d8507db5a700f90',
            name: 'Custom Voice',
            description: 'High-quality custom voice model',
            language: 'en',
            gender: 'neutral'
          }
        ],
        default: '090623498e9843068d8507db5a700f90'
      }
    });
  } catch (error) {
    logger.error('API voices error:', error.message);
    res.status(500).json({ 
      success: false,
      error: {
        code: 'VOICES_FETCH_FAILED',
        message: 'Failed to fetch available voices',
        details: error.message
      }
    });
  }
});

// Get system statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const stats = {
      totalScripts: 0,
      totalAudio: 0,
      totalStorageUsed: 0,
      apiVersion: '1.0.0',
      uptime: process.uptime()
    };

    // Count script files
    const scriptsDir = './output/scripts';
    if (await fs.pathExists(scriptsDir)) {
      const scriptFiles = await fs.readdir(scriptsDir);
      stats.totalScripts = scriptFiles.length;
      
      for (const file of scriptFiles) {
        const filePath = path.join(scriptsDir, file);
        const fileStats = await fs.stat(filePath);
        stats.totalStorageUsed += fileStats.size;
      }
    }

    // Count audio files
    const audioDir = './output/audio';
    if (await fs.pathExists(audioDir)) {
      const audioFiles = await fs.readdir(audioDir);
      stats.totalAudio = audioFiles.length;
      
      for (const file of audioFiles) {
        const filePath = path.join(audioDir, file);
        const fileStats = await fs.stat(filePath);
        stats.totalStorageUsed += fileStats.size;
      }
    }

    // Format storage size
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    stats.totalStorageUsed = formatBytes(stats.totalStorageUsed);
    stats.uptime = Math.floor(stats.uptime / 60) + ' minutes';

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('API stats error:', error.message);
    res.status(500).json({ 
      success: false,
      error: {
        code: 'STATS_FETCH_FAILED',
        message: 'Failed to fetch system statistics',
        details: error.message
      }
    });
  }
});

// Error handling middleware
app.use(ValidationMiddleware.errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
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
