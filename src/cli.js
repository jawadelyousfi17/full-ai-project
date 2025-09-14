#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const config = require('./utils/config');
const logger = require('./utils/logger');
const ScriptWriter = require('./services/scriptWriter');
const FishAudioService = require('./services/fishAudio');

const program = new Command();

// Initialize services
let scriptWriter;
let fishAudio;

async function initializeServices() {
  try {
    config.validate();
    scriptWriter = new ScriptWriter();
    return true;
  } catch (error) {
    logger.error('Initialization failed:', error.message);
    return false;
  }
}

async function initializeAudioServices() {
  try {
    fishAudio = new FishAudioService();
    return true;
  } catch (error) {
    logger.error('Audio service initialization failed:', error.message);
    return false;
  }
}

// CLI Commands
program
  .name('ai-video')
  .description('AI-powered video generation tool')
  .version('1.0.0');

program
  .command('generate-script')
  .alias('script')
  .description('Generate a plain text audio script for a given topic')
  .argument('[topic]', 'Topic for the audio script')
  .option('-d, --duration <minutes>', 'Script duration in minutes', '3')
  .option('-s, --style <style>', 'Script style (engaging, educational, entertaining)', 'engaging')
  .option('-a, --audience <audience>', 'Target audience (general, technical, kids, adults)', 'general')
  .option('-t, --tone <tone>', 'Script tone (conversational, formal, casual)', 'conversational')
  .option('-r, --reference <file>', 'Reference script file from templates/ directory for style guidance')
  .action(async (topic, options) => {
    if (!(await initializeServices())) return;

    try {
      // If no topic provided, ask for it
      if (!topic) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'topic',
            message: 'What topic would you like to create an audio script about?',
            validate: (input) => input.trim() ? true : 'Please enter a topic'
          }
        ]);
        topic = answers.topic;
      }

      // Convert duration to number
      options.duration = parseInt(options.duration);

      logger.info(`\n🎬 ${chalk.bold('AI Audio Script Generator')}`);
      logger.info(`Topic: ${chalk.cyan(topic)}`);
      logger.info(`Duration: ${chalk.yellow(options.duration)} minutes`);
      logger.info(`Style: ${chalk.green(options.style)}`);
      logger.info(`Audience: ${chalk.blue(options.audience)}`);
      logger.info(`Tone: ${chalk.magenta(options.tone)}\n`);

      const scriptData = await scriptWriter.generatePlainTextScript(topic, {
        ...options,
        referenceFile: options.reference
      });
      
      console.log('\n' + chalk.green.bold('✨ Script Generated Successfully!'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.bold('Title:'), scriptData.title);
      console.log(chalk.bold('Word Count:'), scriptData.wordCount);
      console.log(chalk.bold('Estimated Duration:'), `${scriptData.estimatedDuration} minutes`);
      console.log(chalk.gray('─'.repeat(50)));
      
      // Show preview of the script
      if (scriptData.content) {
        console.log(chalk.yellow.bold('\n🎯 Script Preview:'));
        console.log(chalk.italic(scriptData.content.substring(0, 200) + '...'));
      }

    } catch (error) {
      logger.error('Failed to generate script:', error.message);
      process.exit(1);
    }
  });

program
  .command('preview')
  .alias('generate-preview')
  .description('Generate a script preview with chapter headlines before full script')
  .argument('[topic]', 'Topic for the audio script')
  .option('-d, --duration <minutes>', 'Script duration in minutes', '3')
  .option('-s, --style <style>', 'Script style (engaging, educational, entertaining)', 'engaging')
  .option('-a, --audience <audience>', 'Target audience (general, technical, kids, adults)', 'general')
  .option('-t, --tone <tone>', 'Script tone (conversational, formal, casual)', 'conversational')
  .option('-r, --reference <file>', 'Reference script file from templates/ directory for style guidance')
  .action(async (topic, options) => {
    if (!(await initializeServices())) return;

    try {
      // If no topic provided, ask for it
      if (!topic) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'topic',
            message: 'What topic would you like to create an audio script about?',
            validate: (input) => input.trim() ? true : 'Please enter a topic'
          }
        ]);
        topic = answers.topic;
      }

      // Convert duration to number
      options.duration = parseInt(options.duration);

      logger.info(`\n🎬 ${chalk.bold('AI Audio Script Preview Generator')}`);
      logger.info(`Topic: ${chalk.cyan(topic)}`);
      logger.info(`Duration: ${chalk.yellow(options.duration)} minutes`);
      logger.info(`Style: ${chalk.green(options.style)}`);
      logger.info(`Audience: ${chalk.blue(options.audience)}`);
      logger.info(`Tone: ${chalk.magenta(options.tone)}\n`);

      // Generate preview with chapter outline
      const previewData = await scriptWriter.generateScriptPreview(topic, {
        ...options,
        referenceFile: options.reference
      });
      
      console.log('\n' + chalk.green.bold('📋 Chapter Outline Generated!'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.bold('Title:'), chalk.cyan(previewData.title));
      console.log(chalk.bold('Estimated Duration:'), chalk.yellow(`${previewData.estimatedDuration} minutes`));
      console.log(chalk.bold('Target Word Count:'), chalk.magenta(`${previewData.wordCountTarget} words`));
      console.log(chalk.gray('─'.repeat(60)));
      
      // Display chapters
      console.log(chalk.yellow.bold('\n📚 Chapter Outline:'));
      previewData.chapters.forEach((chapter, index) => {
        console.log(`\n${chalk.bold.blue(`Chapter ${chapter.number}:`)} ${chalk.bold(chapter.title)}`);
        console.log(chalk.gray(`   ${chapter.description}`));
      });
      
      console.log(chalk.gray('\n' + '─'.repeat(60)));
      
      // Ask for approval
      const approval = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do with this chapter outline?',
          choices: [
            { name: '✅ Approve and generate full script', value: 'approve' },
            { name: '🔄 Regenerate with same settings', value: 'regenerate' },
            { name: '⚙️  Modify settings and regenerate', value: 'modify' },
            { name: '❌ Cancel', value: 'cancel' }
          ]
        }
      ]);
      
      if (approval.action === 'cancel') {
        console.log(chalk.yellow('\n👋 Preview cancelled.'));
        return;
      }
      
      if (approval.action === 'regenerate') {
        console.log(chalk.blue('\n🔄 Regenerating preview with same settings...'));
        // Recursive call with same parameters
        return program.commands.find(cmd => cmd.name() === 'preview').action(topic, options);
      }
      
      if (approval.action === 'modify') {
        console.log(chalk.blue('\n⚙️ Let\'s modify the settings...'));
        const newSettings = await inquirer.prompt([
          {
            type: 'input',
            name: 'duration',
            message: 'Script duration in minutes:',
            default: options.duration.toString(),
            validate: (input) => !isNaN(parseInt(input)) && parseInt(input) > 0 ? true : 'Please enter a valid number'
          },
          {
            type: 'list',
            name: 'style',
            message: 'Script style:',
            default: options.style,
            choices: ['engaging', 'educational', 'entertaining']
          },
          {
            type: 'list',
            name: 'audience',
            message: 'Target audience:',
            default: options.audience,
            choices: ['general', 'technical', 'kids', 'adults']
          },
          {
            type: 'list',
            name: 'tone',
            message: 'Script tone:',
            default: options.tone,
            choices: ['conversational', 'formal', 'casual']
          }
        ]);
        
        newSettings.duration = parseInt(newSettings.duration);
        newSettings.reference = options.reference; // Keep reference file
        
        // Recursive call with new parameters
        return program.commands.find(cmd => cmd.name() === 'preview').action(topic, newSettings);
      }
      
      if (approval.action === 'approve') {
        console.log(chalk.green('\n✅ Generating full script from approved outline...'));
        
        const scriptData = await scriptWriter.generateScriptFromPreview(previewData, {
          duration: options.duration,
          style: options.style,
          audience: options.audience,
          tone: options.tone,
          referenceFile: options.reference
        });
        
        console.log('\n' + chalk.green.bold('✨ Full Script Generated Successfully!'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.bold('Title:'), scriptData.title);
        console.log(chalk.bold('Word Count:'), scriptData.wordCount);
        console.log(chalk.bold('Estimated Duration:'), `${scriptData.estimatedDuration} minutes`);
        console.log(chalk.gray('─'.repeat(50)));
        
        // Show preview of the script
        if (scriptData.content) {
          console.log(chalk.yellow.bold('\n🎯 Script Preview:'));
          console.log(chalk.italic(scriptData.content.substring(0, 300) + '...'));
          console.log(chalk.gray('\n💾 Full script saved to: ' + scriptData.filePath));
        }
      }

    } catch (error) {
      logger.error('Failed to generate preview:', error.message);
      process.exit(1);
    }
  });

// Database commands removed - file-only storage

program
  .command('interactive')
  .alias('i')
  .description('Interactive mode for script generation')
  .action(async () => {
    if (!(await initializeServices())) return;

    console.log(chalk.blue.bold('\n🎬 Welcome to AI Audio Script Generator!'));
    console.log(chalk.gray('Interactive mode - Let\'s create your audio script step by step.\n'));

    try {
      const initialAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'topic',
          message: 'What topic would you like to create an audio script about?',
          validate: (input) => input.trim() ? true : 'Please enter a topic'
        },
        {
          type: 'input',
          name: 'duration',
          message: 'How long should the audio be? (in minutes)',
          default: '3',
          validate: (input) => !isNaN(parseInt(input)) && parseInt(input) > 0 ? true : 'Please enter a valid number'
        },
        {
          type: 'list',
          name: 'style',
          message: 'What style should the script have?',
          choices: [
            { name: 'Engaging - Hook listeners and keep them interested', value: 'engaging' },
            { name: 'Educational - Informative and structured', value: 'educational' },
            { name: 'Entertaining - Fun and lighthearted', value: 'entertaining' }
          ]
        },
        {
          type: 'list',
          name: 'audience',
          message: 'Who is your target audience?',
          choices: [
            { name: 'General - Broad audience appeal', value: 'general' },
            { name: 'Technical - Industry professionals', value: 'technical' },
            { name: 'Kids - Children and young teens', value: 'kids' },
            { name: 'Adults - Mature audience', value: 'adults' }
          ]
        },
        {
          type: 'list',
          name: 'tone',
          message: 'What tone should the script have?',
          choices: [
            { name: 'Conversational - Natural and friendly', value: 'conversational' },
            { name: 'Formal - Professional and structured', value: 'formal' },
            { name: 'Casual - Relaxed and informal', value: 'casual' }
          ]
        },
        {
          type: 'list',
          name: 'generationMode',
          message: 'How would you like to generate your script?',
          choices: [
            { name: '📋 Preview Mode - See chapter outline first, then approve', value: 'preview' },
            { name: '🚀 Direct Mode - Generate full script immediately', value: 'direct' }
          ]
        }
      ]);

      // Convert duration to number
      initialAnswers.duration = parseInt(initialAnswers.duration);

      logger.info(`\n🎬 ${chalk.bold('Generating Your Audio Script')}`);
      logger.info(`Topic: ${chalk.cyan(initialAnswers.topic)}`);
      logger.info(`Duration: ${chalk.yellow(initialAnswers.duration)} minutes`);
      logger.info(`Style: ${chalk.green(initialAnswers.style)}`);
      logger.info(`Audience: ${chalk.blue(initialAnswers.audience)}`);
      logger.info(`Tone: ${chalk.magenta(initialAnswers.tone)}`);
      logger.info(`Mode: ${chalk.white(initialAnswers.generationMode === 'preview' ? '📋 Preview' : '🚀 Direct')}\n`);

      if (initialAnswers.generationMode === 'preview') {
        // Use preview workflow
        const previewData = await scriptWriter.generateScriptPreview(initialAnswers.topic, initialAnswers);
        
        console.log('\n' + chalk.green.bold('📋 Chapter Outline Generated!'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.bold('Title:'), chalk.cyan(previewData.title));
        console.log(chalk.bold('Estimated Duration:'), chalk.yellow(`${previewData.estimatedDuration} minutes`));
        console.log(chalk.bold('Target Word Count:'), chalk.magenta(`${previewData.wordCountTarget} words`));
        console.log(chalk.gray('─'.repeat(60)));
        
        // Display chapters
        console.log(chalk.yellow.bold('\n📚 Chapter Outline:'));
        previewData.chapters.forEach((chapter, index) => {
          console.log(`\n${chalk.bold.blue(`Chapter ${chapter.number}:`)} ${chalk.bold(chapter.title)}`);
          console.log(chalk.gray(`   ${chapter.description}`));
        });
        
        console.log(chalk.gray('\n' + '─'.repeat(60)));
        
        // Ask for approval
        const approval = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'approved',
            message: 'Do you approve this chapter outline and want to generate the full script?',
            default: true
          }
        ]);
        
        if (approval.approved) {
          console.log(chalk.green('\n✅ Generating full script from approved outline...'));
          
          const scriptData = await scriptWriter.generateScriptFromPreview(previewData, initialAnswers);
          
          console.log('\n' + chalk.green.bold('✨ Full Script Generated Successfully!'));
          console.log(chalk.gray('─'.repeat(50)));
          console.log(chalk.bold('Title:'), scriptData.title);
          console.log(chalk.bold('Word Count:'), scriptData.wordCount);
          console.log(chalk.bold('Estimated Duration:'), `${scriptData.estimatedDuration} minutes`);
          console.log(chalk.gray('─'.repeat(50)));
          
          if (scriptData.content) {
            console.log(chalk.yellow.bold('\n🎯 Script Preview:'));
            console.log(chalk.italic(scriptData.content.substring(0, 300) + '...'));
            console.log(chalk.gray('\n💾 Full script saved to: ' + scriptData.filePath));
          }
        } else {
          console.log(chalk.yellow('\n👋 Script generation cancelled.'));
        }
      } else {
        // Direct generation
        const scriptData = await scriptWriter.generatePlainTextScript(initialAnswers.topic, initialAnswers);
        
        console.log('\n' + chalk.green.bold('✨ Script Generated Successfully!'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.bold('Title:'), scriptData.title);
        console.log(chalk.bold('Word Count:'), scriptData.wordCount);
        console.log(chalk.bold('Estimated Duration:'), `${scriptData.estimatedDuration} minutes`);
        console.log(chalk.gray('─'.repeat(50)));
        
        if (scriptData.content) {
          console.log(chalk.yellow.bold('\n🎯 Script Preview:'));
          console.log(chalk.italic(scriptData.content.substring(0, 200) + '...'));
          console.log(chalk.gray('\n💾 Full script saved to: ' + scriptData.filePath));
        }
      }

    } catch (error) {
      logger.error('Failed to generate script:', error.message);
      process.exit(1);
    }
  });

// Audio generation command
program
  .command('generate-audio')
  .alias('audio')
  .description('Generate audio from text or script file')
  .argument('[text]', 'Text to convert to audio (or use --file for script file)')
  .option('-f, --file <path>', 'Path to script file to convert to audio')
  .option('-o, --output <path>', 'Output audio file path')
  .option('--format <format>', 'Audio format (wav, mp3, flac)', 'wav')
  .option('--voice <voice>', 'Voice model to use', '090623498e9843068d8507db5a700f90')
  .option('--chunk-length <length>', 'Maximum chunk length for long text', '500')
  .option('--bitrate <bitrate>', 'Audio bitrate', '128000')
  .option('--latency <latency>', 'Latency setting (normal, balanced)', 'balanced')
  .action(async (text, options) => {
    const initialized = await initializeAudioServices();
    if (!initialized) {
      process.exit(1);
    }

    try {
      let inputText = text;
      
      // If file option is provided, read from file
      if (options.file) {
        const fs = require('fs-extra');
        const path = require('path');
        
        if (!await fs.pathExists(options.file)) {
          logger.error(`Script file not found: ${options.file}`);
          process.exit(1);
        }
        
        console.log(chalk.blue('📖 Reading script from file...'));
        inputText = await fs.readFile(options.file, 'utf8');
        console.log(chalk.green(`✅ Loaded script (${inputText.length} characters)`));
      }
      
      if (!inputText || inputText.trim().length === 0) {
        logger.error('No text provided. Use either text argument or --file option.');
        process.exit(1);
      }
      
      console.log(chalk.blue('🎵 Generating audio...'));
      console.log(chalk.gray(`Input length: ${inputText.length} characters`));
      console.log(chalk.gray(`Output format: ${options.format}`));
      console.log(chalk.gray(`Voice: ${options.voice || 'default'}`));
      
      let result;
      
      if (options.file) {
        // Use generateAudioFromScript for file input
        const path = require('path');
        const audioOptions = {
          format: options.format,
          referenceId: options.voice === 'default' ? null : options.voice,
          chunkSize: parseInt(options.chunkLength) * 20, // Convert to character count
          mp3Bitrate: parseInt(options.bitrate) / 1000, // Convert to kbps
          latency: options.latency,
          outputDir: options.output ? path.dirname(options.output) : './output/audio',
          filename: options.output ? path.basename(options.output, path.extname(options.output)) : null
        };
        
        result = await fishAudio.generateAudioFromScript(options.file, audioOptions);
      } else {
        // For direct text input, we need to create a temp file or use a different approach
        const fs = require('fs-extra');
        const path = require('path');
        const tempDir = './output/temp';
        await fs.ensureDir(tempDir);
        
        const tempFile = path.join(tempDir, `temp-${Date.now()}.txt`);
        await fs.writeFile(tempFile, inputText);
        
        const audioOptions = {
          format: options.format,
          referenceId: options.voice === 'default' ? null : options.voice,
          chunkSize: parseInt(options.chunkLength) * 20,
          mp3Bitrate: parseInt(options.bitrate) / 1000,
          latency: options.latency,
          outputDir: options.output ? path.dirname(options.output) : './output/audio',
          filename: options.output ? path.basename(options.output, path.extname(options.output)) : null
        };
        
        result = await fishAudio.generateAudioFromScript(tempFile, audioOptions);
        
        // Clean up temp file
        await fs.remove(tempFile);
      }
      
      console.log(chalk.green.bold('\n🎉 Audio generation completed!'));
      console.log(chalk.bold('Output file:'), result.outputPath);
      console.log(chalk.bold('File size:'), `${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(chalk.bold('Duration:'), `~${result.estimatedDuration} seconds`);
      
      if (result.chunks && result.chunks.length > 1) {
        console.log(chalk.bold('Chunks processed:'), result.chunks.length);
      }
      
    } catch (error) {
      logger.error('Failed to generate audio:', error.message);
      process.exit(1);
    }
  });

// Script-to-audio pipeline command
program
  .command('script-to-audio')
  .alias('s2a')
  .description('Generate script and convert to audio in one command')
  .argument('<topic>', 'Topic for script generation')
  .option('-d, --duration <minutes>', 'Target duration in minutes', '3')
  .option('-s, --style <style>', 'Script style (educational, entertaining, documentary, conversational)', 'educational')
  .option('-a, --audience <audience>', 'Target audience (general, children, adults, professionals)', 'general')
  .option('-t, --tone <tone>', 'Script tone (formal, casual, enthusiastic, calm)', 'conversational')
  .option('-r, --reference <file>', 'Reference script file for style guidance')
  .option('--format <format>', 'Audio format (wav, mp3, flac)', 'wav')
  .option('--voice <voice>', 'Voice model to use', '090623498e9843068d8507db5a700f90')
  .option('--preview', 'Use preview mode for script generation')
  .action(async (topic, options) => {
    const scriptInitialized = await initializeServices();
    const audioInitialized = await initializeAudioServices();
    
    if (!scriptInitialized || !audioInitialized) {
      process.exit(1);
    }

    try {
      console.log(chalk.blue.bold('🎬 Starting Script-to-Audio Pipeline'));
      console.log(chalk.gray('─'.repeat(50)));
      
      // Step 1: Generate script
      console.log(chalk.blue('📝 Step 1: Generating script...'));
      
      const scriptOptions = {
        duration: parseInt(options.duration),
        style: options.style,
        audience: options.audience,
        tone: options.tone,
        reference: options.reference
      };
      
      let scriptData;
      if (options.preview) {
        // Use preview workflow
        const previewData = await scriptWriter.generateScriptPreview(topic, scriptOptions);
        console.log(chalk.green('✅ Preview generated'));
        
        // Auto-approve preview for pipeline mode
        console.log(chalk.blue('🔄 Auto-approving preview for pipeline mode...'));
        scriptData = await scriptWriter.generateScriptFromPreview(previewData, scriptOptions);
      } else {
        // Direct script generation
        scriptData = await scriptWriter.generatePlainTextScript(topic, scriptOptions);
      }
      
      console.log(chalk.green('✅ Script generated successfully'));
      console.log(chalk.gray(`Script length: ${scriptData.content.length} characters`));
      
      // Step 2: Generate audio
      console.log(chalk.blue('\n🎵 Step 2: Converting script to audio...'));
      
      const audioOptions = {
        format: options.format,
        referenceId: options.voice === 'default' ? null : options.voice,
        chunkSize: 4000,
        mp3Bitrate: 128,
        latency: options.latency || 'balanced',
        outputDir: './output/audio',
        filename: `${topic.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().replace(/[:.]/g, '-')}`
      };
      
      const audioResult = await fishAudio.generateAudioFromScript(scriptData.filePath, audioOptions);
      
      console.log(chalk.green.bold('\n🎉 Pipeline completed successfully!'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.bold('📝 Script:'), scriptData.filePath);
      console.log(chalk.bold('🎵 Audio:'), audioResult.outputPath);
      console.log(chalk.bold('📊 Stats:'));
      console.log(`  • Script: ${scriptData.content.length} characters, ~${scriptData.estimatedDuration} minutes`);
      console.log(`  • Audio: ${(audioResult.fileSize / 1024 / 1024).toFixed(2)} MB, ~${audioResult.estimatedDuration} seconds`);
      
      if (audioResult.chunks && audioResult.chunks.length > 1) {
        console.log(`  • Processed in ${audioResult.chunks.length} chunks`);
      }
      
    } catch (error) {
      logger.error('Pipeline failed:', error.message);
      process.exit(1);
    }
  });

// Show help if no command provided
if (process.argv.length === 2) {
  console.log(chalk.bold.blue('🎬 AI Video Generation CLI with Text-to-Speech\n'));
  console.log('Available commands:');
  console.log(chalk.yellow('📝 Script Generation:'));
  console.log('  ai-video generate-script [topic]  Generate an audio script directly');
  console.log('  ai-video preview [topic]          Generate chapter outline first, then full script');
  console.log('  ai-video interactive              Interactive script generation with preview option');
  console.log(chalk.yellow('\n🎵 Audio Generation:'));
  console.log('  ai-video generate-audio [text]    Convert text or script file to audio');
  console.log('  ai-video script-to-audio <topic>  Generate script and convert to audio in one command');
  console.log('\nFor detailed help: ai-video --help');
  console.log('\nExamples:');
  console.log('  ai-video preview "How to make pizza" --duration 5 --style educational');
  console.log('  ai-video generate-audio --file ./output/script.txt --format mp3 --voice default');
  console.log('  ai-video script-to-audio "Climate change explained" --duration 10 --format wav --preview');
  console.log('\n💡 Tips:');
  console.log('  • Use --reference to specify a style template from the templates/ directory');
  console.log('  • Use preview mode to see chapter outlines before generating full scripts');
  console.log('  • Scripts are optimized for audio-only consumption');
  console.log('  • Use script-to-audio for complete script-to-audio pipeline');
  console.log('  • Set FISH_AUDIO_API_KEY environment variable for audio generation');
}

program.parse();
