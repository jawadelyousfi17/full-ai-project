const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const config = require('../utils/config');
const logger = require('../utils/logger');

class FishAudioService {
  constructor() {
    this.apiKey = config.getFishAudioApiKey();
    this.baseUrl = 'https://api.fish.audio/v1';
    this.defaultModel = 's1';
  }

  async generateAudio(text, options = {}) {
    const {
      referenceId = null,
      referenceAudio = null,
      format = 'mp3',
      mp3Bitrate = 128,
      chunkLength = 200,
      normalize = true,
      latency = 'normal',
      model = this.defaultModel
    } = options;

    logger.info(`Generating audio with FishAudio (${text.length} characters)`);
    const spinner = logger.spinner('Converting text to speech...');

    try {
      // Prepare request payload
      const requestData = {
        text: text.trim(),
        chunk_length: chunkLength,
        format,
        mp3_bitrate: mp3Bitrate,
        normalize,
        latency,
        references: []
      };

      // Only add reference_id if it's provided and not "default"
      if (referenceId && referenceId !== 'default') {
        requestData.reference_id = referenceId;
      }

      // Add reference audio if provided
      if (referenceAudio && referenceAudio.audioPath && referenceAudio.text) {
        const audioBuffer = await fs.readFile(referenceAudio.audioPath);
        requestData.references.push({
          audio: audioBuffer,
          text: referenceAudio.text
        });
      }

      // Make API request
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/tts`,
        data: requestData,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'model': model
        },
        responseType: 'stream',
        timeout: 300000 // 5 minutes timeout for long audio
      });

      spinner.succeed('Audio generated successfully!');
      return response.data;

    } catch (error) {
      spinner.fail('Failed to generate audio');
      
      if (error.response) {
        logger.error(`FishAudio API error (${error.response.status}):`, error.response.data);
        throw new Error(`FishAudio API error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        logger.error('Network error:', error.message);
        throw new Error(`Network error: ${error.message}`);
      } else {
        logger.error('Audio generation error:', error.message);
        throw error;
      }
    }
  }

  async generateAudioFromScript(scriptFilePath, options = {}) {
    const {
      outputDir = path.join(process.cwd(), 'output', 'audio'),
      filename = null,
      referenceId = null,
      referenceAudio = null,
      format = 'mp3',
      chunkSize = 5000, // Split long scripts into chunks
      ...audioOptions
    } = options;

    logger.info(`Converting script to audio: ${scriptFilePath}`);

    try {
      // Read script content
      const scriptContent = await fs.readFile(scriptFilePath, 'utf8');
      
      if (!scriptContent.trim()) {
        throw new Error('Script file is empty');
      }

      // Ensure output directory exists
      await fs.ensureDir(outputDir);

      // Generate filename if not provided
      const scriptName = path.basename(scriptFilePath, path.extname(scriptFilePath));
      let outputFilename;
      if (filename) {
        // If filename is provided, ensure it has the correct extension
        outputFilename = filename.includes('.') ? filename : `${filename}.${format}`;
      } else {
        // Generate default filename with extension
        outputFilename = `${scriptName}_audio_${Date.now()}.${format}`;
      }
      const outputPath = path.join(outputDir, outputFilename);

      // Check if script needs to be chunked for very long content
      if (scriptContent.length > chunkSize) {
        return await this.generateLongAudio(scriptContent, outputPath, {
          referenceId,
          referenceAudio,
          format,
          chunkSize,
          ...audioOptions
        });
      }

      // Generate audio for entire script
      const audioStream = await this.generateAudio(scriptContent, {
        referenceId,
        referenceAudio,
        format,
        ...audioOptions
      });

      // Save audio to file
      const writeStream = fs.createWriteStream(outputPath);
      audioStream.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on('finish', async () => {
          try {
            logger.success(`Audio saved to: ${outputPath}`);
            
            // Get file stats
            const stats = await fs.stat(outputPath);
            const estimatedDuration = this.estimateAudioDuration(scriptContent);
            
            resolve({
              outputPath,
              scriptPath: scriptFilePath,
              fileSize: stats.size,
              estimatedDuration: estimatedDuration,
              duration: estimatedDuration, // Keep both for compatibility
              wordCount: scriptContent.split(/\s+/).length,
              format,
              generatedAt: new Date()
            });
          } catch (error) {
            reject(error);
          }
        });

        writeStream.on('error', reject);
        audioStream.on('error', reject);
      });

    } catch (error) {
      logger.error('Script to audio conversion failed:', error.message);
      throw error;
    }
  }

  async generateAudioFromScriptWithProgress(scriptFilePath, options = {}) {
    const {
      outputDir = path.join(process.cwd(), 'output', 'audio'),
      filename = null,
      referenceId = null,
      referenceAudio = null,
      format = 'mp3',
      chunkSize = 5000,
      onProgress = null,
      ...audioOptions
    } = options;

    logger.info(`Converting script to audio with progress: ${scriptFilePath}`);

    try {
      // Read script content
      const scriptContent = await fs.readFile(scriptFilePath, 'utf8');
      
      if (!scriptContent.trim()) {
        throw new Error('Script file is empty');
      }

      // Ensure output directory exists
      await fs.ensureDir(outputDir);

      // Generate filename if not provided
      const scriptName = path.basename(scriptFilePath, path.extname(scriptFilePath));
      let outputFilename;
      if (filename) {
        outputFilename = filename.includes('.') ? filename : `${filename}.${format}`;
      } else {
        outputFilename = `${scriptName}_audio_${Date.now()}.${format}`;
      }
      const outputPath = path.join(outputDir, outputFilename);

      // Send initial progress
      if (onProgress) {
        onProgress({
          type: 'start',
          textLength: scriptContent.length,
          message: 'Starting audio generation...'
        });
      }

      // Check if script needs to be chunked for very long content
      if (scriptContent.length > chunkSize) {
        return await this.generateLongAudio(scriptContent, outputPath, {
          referenceId,
          referenceAudio,
          format,
          chunkSize,
          onProgress,
          ...audioOptions
        });
      }

      // For single chunk, send progress update
      if (onProgress) {
        onProgress({
          type: 'single_chunk',
          progress: 50,
          totalChunks: 1,
          chunkIndex: 0,
          preview: scriptContent.substring(0, 100) + (scriptContent.length > 100 ? '...' : ''),
          message: 'Generating audio (1 chunk)...'
        });
      }

      // Generate audio for entire script
      const audioStream = await this.generateAudio(scriptContent, {
        referenceId,
        referenceAudio,
        format,
        ...audioOptions
      });

      // Save audio to file
      const writeStream = fs.createWriteStream(outputPath);
      audioStream.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on('finish', async () => {
          try {
            logger.success(`Audio saved to: ${outputPath}`);
            
            // Get file stats
            const stats = await fs.stat(outputPath);
            const estimatedDuration = this.estimateAudioDuration(scriptContent);
            
            const result = {
              outputPath,
              scriptPath: scriptFilePath,
              fileSize: stats.size,
              estimatedDuration: estimatedDuration,
              duration: estimatedDuration,
              wordCount: scriptContent.split(/\s+/).length,
              format,
              generatedAt: new Date()
            };

            // Send completion progress for single chunk
            if (onProgress) {
              onProgress({
                type: 'complete',
                progress: 100,
                totalChunks: 1,
                message: 'Audio generation complete! (1 chunk)'
              });
            }

            resolve(result);
          } catch (error) {
            reject(error);
          }
        });

        writeStream.on('error', reject);
        audioStream.on('error', reject);
      });

    } catch (error) {
      logger.error('Script to audio conversion with progress failed:', error.message);
      throw error;
    }
  }

  async generateLongAudio(text, outputPath, options = {}) {
    const {
      referenceId = null,
      referenceAudio = null,
      format = 'mp3',
      chunkSize = 5000,
      onProgress = null,
      ...audioOptions
    } = options;

    const spinner = ora('Splitting text into chunks...').start();

    try {
      // Split text into manageable chunks
      const chunks = this.splitTextIntoChunks(text, chunkSize);
      const tempAudioFiles = [];

      spinner.succeed(`Split into ${chunks.length} chunks`);

      if (onProgress) {
        onProgress({
          type: 'chunks_created',
          totalChunks: chunks.length,
          chunks: chunks.map((chunk, i) => ({
            index: i,
            preview: chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''),
            length: chunk.length
          }))
        });
      }

      // Generate audio for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const tempPath = outputPath.replace(`.${format}`, `_chunk_${i}.${format}`);
        
        spinner.text = `Generating audio chunk ${i + 1}/${chunks.length}...`;
        
        if (onProgress) {
          onProgress({
            type: 'chunk_start',
            chunkIndex: i,
            totalChunks: chunks.length,
            chunkPreview: chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''),
            progress: Math.round((i / chunks.length) * 100),
            message: `Processing audio chunk ${i + 1} of ${chunks.length}`
          });
        }
        
        const audioStream = await this.generateAudio(chunk, {
          referenceId,
          referenceAudio,
          format,
          ...audioOptions
        });

        // Save chunk to temporary file
        const writeStream = fs.createWriteStream(tempPath);
        audioStream.pipe(writeStream);

        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          audioStream.on('error', reject);
        });

        tempAudioFiles.push(tempPath);

        if (onProgress) {
          onProgress({
            type: 'chunk_complete',
            chunkIndex: i,
            totalChunks: chunks.length,
            progress: Math.round(((i + 1) / chunks.length) * 90), // 90% for generation, 10% for combining
            message: `Completed audio chunk ${i + 1} of ${chunks.length}`
          });
        }
      }

      spinner.text = 'Combining audio segments...';

      if (onProgress) {
        onProgress({
          type: 'combining',
          progress: 90,
          message: `Combining ${chunks.length} audio segments into final file...`
        });
      }

      // Combine all audio chunks (this is a simplified approach)
      // In production, you might want to use ffmpeg for better audio concatenation
      await this.combineAudioFiles(tempAudioFiles, outputPath, format);

      // Clean up temporary files
      for (const tempFile of tempAudioFiles) {
        try {
          await fs.remove(tempFile);
        } catch (cleanupError) {
          logger.warn(`Failed to clean up temp file: ${tempFile}`);
        }
      }

      spinner.succeed(`Generated long-form audio with ${chunks.length} segments!`);

      if (onProgress) {
        onProgress({
          type: 'complete',
          progress: 100,
          message: `Audio generation complete! Generated ${chunks.length} chunks successfully.`,
          totalChunks: chunks.length
        });
      }

      return {
        outputPath,
        duration: this.estimateAudioDuration(text),
        wordCount: text.split(/\s+/).length,
        chunks: chunks.length,
        format,
        generatedAt: new Date()
      };

    } catch (error) {
      // Clean up temporary files on error
      for (const tempFile of tempAudioFiles) {
        try {
          await fs.remove(tempFile);
        } catch (cleanupError) {
          logger.warn(`Failed to clean up temp file: ${tempFile}`);
        }
      }
      
      spinner.fail('Failed to generate long-form audio');
      throw error;
    }
  }

  splitTextIntoChunks(text, chunkSize, overlapSize = 200) {
    const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Add overlap from the end of current chunk
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlapSize / 10)); // Approximate word overlap
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  async combineAudioFiles(audioFiles, outputPath, format) {
    // Simple concatenation - in production, use ffmpeg for better results
    const outputStream = fs.createWriteStream(outputPath);
    
    for (const audioFile of audioFiles) {
      const inputStream = fs.createReadStream(audioFile);
      await new Promise((resolve, reject) => {
        inputStream.pipe(outputStream, { end: false });
        inputStream.on('end', resolve);
        inputStream.on('error', reject);
      });
    }
    
    outputStream.end();
    
    return new Promise((resolve, reject) => {
      outputStream.on('finish', resolve);
      outputStream.on('error', reject);
    });
  }

  estimateAudioDuration(text) {
    // Estimate based on average speaking rate (150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const minutes = wordCount / 150;
    return Math.round(minutes * 60 * 100) / 100; // Duration in seconds
  }

  async listAvailableVoices() {
    // This would require additional API endpoints for voice listing
    // For now, return common reference IDs or allow custom ones
    return {
      defaultVoices: [
        { id: 'default', name: 'Default Voice', language: 'en' },
        { id: 'speech-1.5', name: 'Speech Model 1.5', language: 'multi' },
        { id: 'speech-1.6', name: 'Speech Model 1.6', language: 'multi' },
        { id: 's1', name: 'S1 Model', language: 'multi' }
      ],
      customVoices: 'Use reference_id from Fish Audio playground or upload custom reference audio'
    };
  }

  validateAudioOptions(options) {
    const validFormats = ['mp3', 'wav', 'pcm'];
    const validBitrates = [64, 128, 192];
    const validLatencies = ['normal', 'balanced'];

    if (options.format && !validFormats.includes(options.format)) {
      throw new Error(`Invalid format: ${options.format}. Valid options: ${validFormats.join(', ')}`);
    }

    if (options.mp3Bitrate && !validBitrates.includes(options.mp3Bitrate)) {
      throw new Error(`Invalid bitrate: ${options.mp3Bitrate}. Valid options: ${validBitrates.join(', ')}`);
    }

    if (options.latency && !validLatencies.includes(options.latency)) {
      throw new Error(`Invalid latency: ${options.latency}. Valid options: ${validLatencies.join(', ')}`);
    }

    if (options.chunkLength && (options.chunkLength < 100 || options.chunkLength > 300)) {
      throw new Error('Chunk length must be between 100 and 300');
    }

    return true;
  }
}

module.exports = FishAudioService;
