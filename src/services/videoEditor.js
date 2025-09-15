const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');

class VideoEditorService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp/video');
    this.outputDir = path.join(__dirname, '../../output/video');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create video directories:', error);
    }
  }

  /**
   * Process multiple video shorts with audio and background music
   * @param {Object} options - Processing options
   * @param {Array} options.videoFiles - Array of video file paths (5s each)
   * @param {string} options.audioFile - Main audio file path
   * @param {string} options.bgMusicFile - Background music file path
   * @param {number} options.audioVolume - Audio volume (0-100)
   * @param {number} options.bgMusicVolume - Background music volume (0-100)
   * @param {string} options.resolution - Output resolution (e.g., '1920x1080', '1280x720')
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<Object>} Result with output file path and metadata
   */
  async processVideoComposition(options) {
    const {
      videoFiles,
      audioFile,
      bgMusicFile,
      audioVolume = 80,
      bgMusicVolume = 30,
      resolution = '1920x1080',
      onProgress
    } = options;

    const jobId = crypto.randomUUID();
    const outputPath = path.join(this.outputDir, `video_${jobId}.mp4`);
    
    try {
      logger.info(`Starting video composition job ${jobId}`);
      
      // Step 1: Validate inputs
      await this.validateInputs(videoFiles, audioFile, bgMusicFile);
      onProgress && onProgress({ step: 'validation', progress: 10 });

      // Step 2: Get audio duration to determine total video length
      const audioDuration = await this.getAudioDuration(audioFile);
      onProgress && onProgress({ step: 'analysis', progress: 20 });

      // Step 3: Create looped video sequence
      const loopedVideoPath = await this.createLoopedVideoSequence(
        videoFiles, 
        audioDuration, 
        resolution,
        jobId
      );
      onProgress && onProgress({ step: 'video_processing', progress: 50 });

      // Step 4: Process audio layers
      const processedAudioPath = await this.processAudioLayers(
        audioFile,
        bgMusicFile,
        audioDuration,
        audioVolume,
        bgMusicVolume,
        jobId
      );
      onProgress && onProgress({ step: 'audio_processing', progress: 70 });

      // Step 5: Combine video and audio
      await this.combineVideoAndAudio(
        loopedVideoPath,
        processedAudioPath,
        outputPath,
        resolution
      );
      onProgress && onProgress({ step: 'final_composition', progress: 90 });

      // Step 6: Get output metadata
      const metadata = await this.getVideoMetadata(outputPath);
      onProgress && onProgress({ step: 'completed', progress: 100 });

      // Cleanup temp files
      await this.cleanupTempFiles([loopedVideoPath, processedAudioPath]);

      logger.info(`Video composition completed: ${outputPath}`);
      
      return {
        success: true,
        jobId,
        outputPath,
        metadata,
        duration: audioDuration
      };

    } catch (error) {
      logger.error(`Video composition failed for job ${jobId}:`, error);
      throw error;
    }
  }

  async validateInputs(videoFiles, audioFile, bgMusicFile) {
    // Check if video files exist and are valid
    for (const videoFile of videoFiles) {
      try {
        await fs.access(videoFile);
        const duration = await this.getVideoDuration(videoFile);
        // Accept videos of any duration
      } catch (error) {
        throw new Error(`Invalid video file ${path.basename(videoFile)}: ${error.message}`);
      }
    }

    // Check audio file
    if (audioFile) {
      try {
        await fs.access(audioFile);
      } catch (error) {
        throw new Error(`Audio file not found: ${path.basename(audioFile)}`);
      }
    }

    // Check background music file
    if (bgMusicFile) {
      try {
        await fs.access(bgMusicFile);
      } catch (error) {
        throw new Error(`Background music file not found: ${path.basename(bgMusicFile)}`);
      }
    }
  }

  async createLoopedVideoSequence(videoFiles, targetDuration, resolution, jobId) {
    const tempVideoPath = path.join(this.tempDir, `looped_video_${jobId}.mp4`);
    
    return new Promise((resolve, reject) => {
      try {
        // Get actual durations of video files first
        Promise.all(videoFiles.map(file => this.getVideoDuration(file)))
          .then(durations => {
            const totalSingleLoopDuration = durations.reduce((sum, duration) => sum + duration, 0);
            const loopCount = Math.ceil(targetDuration / totalSingleLoopDuration);
            
            logger.info(`Creating looped video: ${videoFiles.length} files, total duration ${totalSingleLoopDuration}s, need ${loopCount} loops for ${targetDuration}s target`);
            
            let command = ffmpeg();
            
            // Add all video files multiple times for looping
            for (let loop = 0; loop < loopCount; loop++) {
              videoFiles.forEach(videoFile => {
                command = command.input(videoFile);
              });
            }

            // Create filter complex for concatenation and scaling
            const totalInputs = videoFiles.length * loopCount;
            let filterComplex = '';
            
            // Parse resolution
            const [width, height] = resolution.split('x').map(Number);
            
            // Scale all inputs to target resolution
            for (let i = 0; i < totalInputs; i++) {
              filterComplex += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`;
            }
            
            // Concatenate all scaled videos
            filterComplex += videoFiles.map((_, i) => 
              Array.from({length: loopCount}, (_, loop) => `[v${loop * videoFiles.length + i}]`)
            ).flat().join('') + `concat=n=${totalInputs}:v=1:a=0[outv]`;

            logger.info(`FFmpeg filter complex: ${filterComplex}`);

            command
              .complexFilter(filterComplex)
              .outputOptions([
                '-map', '[outv]',
                '-t', targetDuration.toString(),
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p'
              ])
              .output(tempVideoPath)
              .on('start', (commandLine) => {
                logger.info(`FFmpeg command: ${commandLine}`);
              })
              .on('stderr', (stderrLine) => {
                logger.debug(`FFmpeg stderr: ${stderrLine}`);
              })
              .on('end', () => {
                logger.info(`Video looping completed: ${tempVideoPath}`);
                resolve(tempVideoPath);
              })
              .on('error', (err, stdout, stderr) => {
                logger.error(`FFmpeg error: ${err.message}`);
                logger.error(`FFmpeg stdout: ${stdout}`);
                logger.error(`FFmpeg stderr: ${stderr}`);
                reject(new Error(`Video processing failed: ${err.message}. FFmpeg stderr: ${stderr}`));
              })
              .run();
          })
          .catch(reject);
      } catch (error) {
        logger.error(`Error in createLoopedVideoSequence: ${error.message}`);
        reject(error);
      }
    });
  }

  async processAudioLayers(audioFile, bgMusicFile, duration, audioVolume, bgMusicVolume, jobId) {
    const tempAudioPath = path.join(this.tempDir, `processed_audio_${jobId}.mp3`);
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      if (audioFile) {
        command = command.input(audioFile);
      }
      
      if (bgMusicFile) {
        command = command.input(bgMusicFile);
      }

      let filterComplex = '';
      let mapOptions = [];

      if (audioFile && bgMusicFile) {
        // Mix main audio with background music
        filterComplex = `
          [0:a]volume=${audioVolume / 100}[a0];
          [1:a]volume=${bgMusicVolume / 100},aloop=loop=-1:size=2e+09[a1];
          [a0][a1]amix=inputs=2:duration=first:dropout_transition=3[outa]
        `;
        mapOptions = ['-map', '[outa]'];
      } else if (audioFile) {
        filterComplex = `[0:a]volume=${audioVolume / 100}[outa]`;
        mapOptions = ['-map', '[outa]'];
      } else if (bgMusicFile) {
        filterComplex = `[0:a]volume=${bgMusicVolume / 100},aloop=loop=-1:size=2e+09[outa]`;
        mapOptions = ['-map', '[outa]'];
      }

      logger.info(`Processing audio layers: audioFile=${!!audioFile}, bgMusicFile=${!!bgMusicFile}, duration=${duration}s`);
      logger.info(`Audio filter complex: ${filterComplex}`);

      command
        .complexFilter(filterComplex)
        .outputOptions([
          ...mapOptions,
          '-t', duration.toString(),
          '-c:a', 'aac',
          '-b:a', '128k'
        ])
        .output(tempAudioPath)
        .on('start', (commandLine) => {
          logger.info(`Audio FFmpeg command: ${commandLine}`);
        })
        .on('stderr', (stderrLine) => {
          logger.debug(`Audio FFmpeg stderr: ${stderrLine}`);
        })
        .on('end', () => {
          logger.info(`Audio processing completed: ${tempAudioPath}`);
          resolve(tempAudioPath);
        })
        .on('error', (err, stdout, stderr) => {
          logger.error(`Audio FFmpeg error: ${err.message}`);
          logger.error(`Audio FFmpeg stdout: ${stdout}`);
          logger.error(`Audio FFmpeg stderr: ${stderr}`);
          reject(new Error(`Audio processing failed: ${err.message}. FFmpeg stderr: ${stderr}`));
        })
        .run();
    });
  }

  async combineVideoAndAudio(videoPath, audioPath, outputPath, resolution) {
    return new Promise((resolve, reject) => {
      logger.info(`Combining video and audio: ${videoPath} + ${audioPath} -> ${outputPath}`);
      
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-shortest'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.info(`Final FFmpeg command: ${commandLine}`);
        })
        .on('stderr', (stderrLine) => {
          logger.debug(`Final FFmpeg stderr: ${stderrLine}`);
        })
        .on('end', () => {
          logger.info(`Video composition completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          logger.error(`Final FFmpeg error: ${err.message}`);
          logger.error(`Final FFmpeg stdout: ${stdout}`);
          logger.error(`Final FFmpeg stderr: ${stderr}`);
          reject(new Error(`Final composition failed: ${err.message}. FFmpeg stderr: ${stderr}`));
        })
        .run();
    });
  }

  async getVideoDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
  }

  async getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
  }

  async getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitRate: metadata.format.bit_rate,
          resolution: `${metadata.streams[0].width}x${metadata.streams[0].height}`,
          fps: eval(metadata.streams[0].r_frame_rate)
        });
      });
    });
  }

  async cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
      }
    }
  }

  async deleteOutputFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info(`Deleted output file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to delete output file ${filePath}:`, error);
      throw error;
    }
  }
}

module.exports = new VideoEditorService();
