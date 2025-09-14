# AI Video Generator

A comprehensive AI-powered video generation tool that transforms topics into complete videos through multiple AI services.

## Features

- **Script Writing**: Generate engaging video scripts using Claude AI
- **AI Voice Synthesis**: Convert scripts to natural-sounding speech
- **Image Generation**: Create relevant visuals for video content
- **Image-to-Video**: Transform static images into dynamic video clips
- **Video Assembly**: Combine all elements into a final video

## Current Status

✅ Script Writing Microservice (Claude AI)  
🚧 AI Voice Synthesis (Coming Soon)  
🚧 Image Generation (Coming Soon)  
🚧 Image-to-Video AI (Coming Soon)  
🚧 Video Assembly (Coming Soon)  

## Installation

```bash
npm install
```

## Database Setup

This project uses MongoDB for persistent data storage. You have two options:

### Option 1: Local MongoDB
1. Install MongoDB on your system
2. Start MongoDB service:
   ```bash
   # On Ubuntu/Debian
   sudo systemctl start mongod
   
   # On macOS with Homebrew
   brew services start mongodb-community
   
   # On Windows
   net start MongoDB
   ```

### Option 2: MongoDB Atlas (Cloud)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get your connection string

## Configuration

Create a `.env` file in the root directory:

```env
# Claude AI API Key (Required)
ANTHROPIC_API_KEY=your_claude_api_key_here

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ai-video-generator
# For MongoDB Atlas, use: mongodb+srv://username:password@cluster.mongodb.net/ai-video-generator

# Optional Configuration
LOG_LEVEL=info
OUTPUT_DIR=./output
```

## Usage

### Generate a Script

```bash
# Interactive mode (recommended)
npm start interactive

# Direct command
npm start generate-script "How to make pizza"

# With custom parameters
npm start generate-script "AI in healthcare" --duration 5 --style educational --audience professionals
```

### Manage Scripts

```bash
# List all scripts
npm start list-scripts

# Search scripts
npm start search-scripts "pizza"

# View specific script
npm start view-script <script-id>

# Show statistics
npm start stats
```

## Project Structure

```
src/
├── cli.js              # Main CLI interface
├── index.js            # Entry point
├── database/
│   ├── connection.js   # MongoDB connection management
│   └── models/
│       ├── Script.js   # Script data model
│       ├── Project.js  # Project data model
│       └── index.js    # Model exports
├── services/
│   ├── scriptWriter.js # Claude AI script generation
│   ├── voiceSynth.js   # AI voice synthesis (future)
│   ├── imageGen.js     # Image generation (future)
│   └── videoAssembly.js # Video assembly (future)
└── utils/
    ├── config.js       # Configuration management
    └── logger.js       # Logging utilities
```

## API Keys Required

- **Anthropic Claude API**: For script generation
- **ElevenLabs API**: For voice synthesis (future)
- **OpenAI DALL-E API**: For image generation (future)
- **Runway ML API**: For image-to-video (future)

## License

MIT
