# AI Video Generation API Documentation

## Overview

The AI Video Generation API provides RESTful endpoints to access all CLI functionality programmatically. The API wraps the existing script generation and audio synthesis capabilities, allowing integration with web applications, mobile apps, and other services.

## Base URL

```
http://localhost:3000
```

## Authentication

Currently, the API uses the same environment variables as the CLI:
- `ANTHROPIC_API_KEY` - Required for script generation
- `FISH_AUDIO_API_KEY` - Required for audio generation

## Endpoints

### Health Check

**GET** `/health`

Returns the health status of the API and its services.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-14T02:13:57.559Z",
  "services": {
    "scriptWriter": true,
    "fishAudio": true
  }
}
```

### Script Generation

**POST** `/api/generate-script`

Generate a video script from a topic.

**Request Body:**
```json
{
  "topic": "How to make coffee",
  "duration": 5,
  "style": "educational",
  "audience": "general",
  "tone": "friendly",
  "reference": "path/to/reference.txt"
}
```

**Parameters:**
- `topic` (string, required): The topic for script generation
- `duration` (number, optional): Target duration in minutes (default: 5)
- `style` (string, optional): Script style - "educational", "entertaining", "documentary", "tutorial" (default: "educational")
- `audience` (string, optional): Target audience - "general", "children", "adults", "professionals" (default: "general")
- `tone` (string, optional): Script tone - "formal", "casual", "friendly", "professional" (default: "friendly")
- `reference` (string, optional): Path to reference material file

**Response:**
```json
{
  "success": true,
  "data": {
    "scriptPath": "output/scripts/how_to_make_coffee_2025-09-14T02-00-00-085Z.txt",
    "metadata": {
      "topic": "How to make coffee",
      "duration": 5,
      "style": "educational",
      "audience": "general",
      "tone": "friendly",
      "wordCount": 750,
      "estimatedReadingTime": "5 minutes"
    }
  }
}
```

### Audio Generation

**POST** `/api/generate-audio`

Generate audio from text or a script file.

**Request Body:**
```json
{
  "text": "Hello, this is a test message",
  "file": "path/to/script.txt",
  "voice": "090623498e9843068d8507db5a700f90",
  "format": "mp3",
  "bitrate": 128,
  "latency": "normal",
  "chunkLength": 500
}
```

**Parameters:**
- `text` (string, optional): Direct text to convert to audio
- `file` (string, optional): Path to script file to convert
- `voice` (string, optional): Voice ID (default: "090623498e9843068d8507db5a700f90")
- `format` (string, optional): Audio format - "mp3", "wav", "flac" (default: "mp3")
- `bitrate` (number, optional): Audio bitrate (default: 128)
- `latency` (string, optional): Processing latency - "normal", "balanced" (default: "normal")
- `chunkLength` (number, optional): Maximum characters per chunk for long texts (default: 500)

**Response:**
```json
{
  "success": true,
  "data": {
    "audioPath": "output/audio/generated_audio_2025-09-14T02-00-00-085Z.mp3",
    "fileSize": 2928222,
    "estimatedDuration": "3.2 minutes",
    "format": "mp3",
    "chunks": 1
  }
}
```

### Complete Pipeline

**POST** `/api/script-to-audio`

Generate a script from a topic and convert it to audio in one request.

**Request Body:**
```json
{
  "topic": "Benefits of meditation",
  "duration": 10,
  "style": "educational",
  "audience": "adults",
  "tone": "calm",
  "voice": "090623498e9843068d8507db5a700f90",
  "format": "mp3"
}
```

**Parameters:**
Combines all parameters from script generation and audio generation endpoints.

**Response:**
```json
{
  "success": true,
  "data": {
    "scriptPath": "output/scripts/benefits_of_meditation_2025-09-14T02-07-46-309Z.txt",
    "audioPath": "output/audio/Benefits-of-meditation-2025-09-14T02-07-46-312Z.mp3",
    "scriptMetadata": {
      "topic": "Benefits of meditation",
      "duration": 10,
      "wordCount": 1500
    },
    "audioMetadata": {
      "fileSize": 5477354,
      "estimatedDuration": "10.2 minutes",
      "format": "mp3",
      "chunks": 2
    }
  }
}
```

### File Management

**GET** `/api/files`

List all generated script and audio files.

**Response:**
```json
{
  "success": true,
  "data": {
    "scripts": [
      {
        "name": "benefits_of_meditation_2025-09-14T02-07-46-309Z.txt",
        "path": "output/scripts/benefits_of_meditation_2025-09-14T02-07-46-309Z.txt",
        "size": 6145,
        "createdAt": "2025-09-14T02:07:46.307Z",
        "modifiedAt": "2025-09-14T02:07:46.307Z"
      }
    ],
    "audio": [
      {
        "name": "Benefits-of-meditation-2025-09-14T02-07-46-312Z.mp3",
        "path": "output/audio/Benefits-of-meditation-2025-09-14T02-07-46-312Z.mp3",
        "size": 5477354,
        "createdAt": "2025-09-14T02:10:16.000Z",
        "modifiedAt": "2025-09-14T02:10:16.036Z"
      }
    ]
  }
}
```

**GET** `/api/download/:type/:filename`

Download a generated file.

**Parameters:**
- `type`: "scripts" or "audio"
- `filename`: Name of the file to download

**Response:** File download with appropriate headers.

**DELETE** `/api/delete/:type/:filename`

Delete a generated file.

**Parameters:**
- `type`: "scripts" or "audio"
- `filename`: Name of the file to delete

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Voice Management

**GET** `/api/voices`

List available voices for audio generation.

**Response:**
```json
{
  "success": true,
  "data": {
    "voices": [
      {
        "id": "090623498e9843068d8507db5a700f90",
        "name": "Custom Voice",
        "description": "High-quality custom voice model"
      }
    ],
    "default": "090623498e9843068d8507db5a700f90"
  }
}
```

### System Statistics

**GET** `/api/stats`

Get system statistics and usage information.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalScripts": 23,
    "totalAudio": 8,
    "totalStorageUsed": "45.2 MB",
    "apiVersion": "1.0.0",
    "uptime": "2 hours 15 minutes"
  }
}
```

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOPIC",
    "message": "Topic is required and cannot be empty",
    "details": "Additional error context if available"
  }
}
```

**Common Error Codes:**
- `INVALID_TOPIC` - Topic parameter is missing or invalid
- `INVALID_DURATION` - Duration parameter is out of valid range
- `FILE_NOT_FOUND` - Requested file does not exist
- `API_KEY_MISSING` - Required API key is not configured
- `GENERATION_FAILED` - Script or audio generation failed
- `INVALID_FORMAT` - Unsupported audio format requested

## Rate Limiting

The API currently does not implement rate limiting, but it's recommended to:
- Limit concurrent requests to avoid overwhelming the AI services
- Cache results when possible to reduce API usage
- Monitor API key usage for external services (Anthropic, FishAudio)

## Examples

### Generate a Simple Script

```bash
curl -X POST http://localhost:3000/api/generate-script \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "How to make coffee",
    "duration": 3,
    "style": "tutorial"
  }'
```

### Generate Audio from Text

```bash
curl -X POST http://localhost:3000/api/generate-audio \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to our coffee brewing tutorial",
    "format": "mp3"
  }'
```

### Complete Pipeline

```bash
curl -X POST http://localhost:3000/api/script-to-audio \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Benefits of exercise",
    "duration": 5,
    "style": "educational",
    "format": "wav"
  }'
```

### List Files

```bash
curl -X GET http://localhost:3000/api/files
```

### Download a File

```bash
curl -X GET http://localhost:3000/api/download/scripts/benefits_of_exercise_2025-09-14T02-00-00-085Z.txt \
  -o downloaded_script.txt
```

## Integration Notes

1. **Async Operations**: Script and audio generation can take several minutes. Consider implementing polling or webhooks for long-running operations.

2. **File Storage**: Generated files are stored locally in the `output/` directory. Consider implementing cloud storage for production use.

3. **Environment Setup**: Ensure all required environment variables are set before starting the API server.

4. **CORS**: The API includes CORS support for web applications.

5. **Content-Type**: Always use `application/json` for POST requests with JSON payloads.

## Starting the API Server

```bash
# Development mode with auto-restart
npm run api:dev

# Production mode
npm run api
```

The server will start on port 3000 by default. Check the console output for confirmation and available endpoints.
