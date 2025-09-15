import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Alert,
  Slider,
  FormControl,
  FormLabel,
  Select,
  Option,
  Stack,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  Divider
} from '@mui/joy';
import {
  CloudUpload,
  VideoFile,
  AudioFile,
  MusicNote,
  Delete,
  Download,
  PlayArrow,
  Stop
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { apiService } from '../services/api';

const VideoComposer = () => {
  const [videoFiles, setVideoFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [bgMusicFile, setBgMusicFile] = useState(null);
  const [audioVolume, setAudioVolume] = useState(80);
  const [bgMusicVolume, setBgMusicVolume] = useState(30);
  const [resolution, setResolution] = useState('1920x1080');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [outputVideo, setOutputVideo] = useState(null);

  const resolutionOptions = [
    { value: '1920x1080', label: '1080p (1920x1080)' },
    { value: '1280x720', label: '720p (1280x720)' },
    { value: '854x480', label: '480p (854x480)' },
    { value: '640x360', label: '360p (640x360)' },
    { value: '3840x2160', label: '4K (3840x2160)' }
  ];

  const onVideosDrop = useCallback((acceptedFiles) => {
    const validFiles = acceptedFiles.filter(file => {
      if (!file.type.startsWith('video/')) {
        setError('Only video files are allowed');
        return false;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit per video
        setError('Video files must be smaller than 50MB');
        return false;
      }
      return true;
    });

    setVideoFiles(prev => [...prev, ...validFiles].slice(0, 10)); // Max 10 videos
    setError(null);
  }, []);

  const onAudioDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file.type.startsWith('audio/')) {
      setError('Only audio files are allowed');
      return;
    }
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setError('Audio file must be smaller than 100MB');
      return;
    }
    setAudioFile(file);
    setError(null);
  }, []);

  const onBgMusicDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file.type.startsWith('audio/')) {
      setError('Only audio files are allowed');
      return;
    }
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setError('Background music file must be smaller than 100MB');
      return;
    }
    setBgMusicFile(file);
    setError(null);
  }, []);

  const {
    getRootProps: getVideosRootProps,
    getInputProps: getVideosInputProps,
    isDragActive: isVideosDragActive
  } = useDropzone({
    onDrop: onVideosDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm']
    },
    multiple: true
  });

  const {
    getRootProps: getAudioRootProps,
    getInputProps: getAudioInputProps,
    isDragActive: isAudioDragActive
  } = useDropzone({
    onDrop: onAudioDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.m4a']
    },
    multiple: false
  });

  const {
    getRootProps: getBgMusicRootProps,
    getInputProps: getBgMusicInputProps,
    isDragActive: isBgMusicDragActive
  } = useDropzone({
    onDrop: onBgMusicDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.m4a']
    },
    multiple: false
  });

  const removeVideoFile = (index) => {
    setVideoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeAudioFile = () => {
    setAudioFile(null);
  };

  const removeBgMusicFile = () => {
    setBgMusicFile(null);
  };

  const pollJobStatus = async (jobId) => {
    try {
      const response = await apiService.getVideoJobStatus(jobId);
      const job = response.job;

      setProgress(job.progress || 0);
      setCurrentStep(job.step || '');

      if (job.status === 'completed') {
        setIsProcessing(false);
        setSuccess('Video composition completed successfully!');
        setOutputVideo({
          jobId: job.id,
          metadata: job.result.metadata,
          duration: job.result.duration
        });
        return true;
      } else if (job.status === 'failed') {
        setIsProcessing(false);
        setError(job.error || 'Video composition failed');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error polling job status:', error);
      return false;
    }
  };

  const startComposition = async () => {
    if (!videoFiles.length) {
      setError('Please upload at least one video file');
      return;
    }

    if (!audioFile) {
      setError('Please upload an audio file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setCurrentStep('Uploading files...');
    setError(null);
    setSuccess(null);
    setOutputVideo(null);

    try {
      const formData = new FormData();
      
      // Add video files
      videoFiles.forEach((file) => {
        formData.append('videos', file);
      });

      // Add audio file
      formData.append('audio', audioFile);

      // Add background music if provided
      if (bgMusicFile) {
        formData.append('bgMusic', bgMusicFile);
      }

      // Add configuration
      formData.append('audioVolume', audioVolume.toString());
      formData.append('bgMusicVolume', bgMusicVolume.toString());
      formData.append('resolution', resolution);

      const response = await apiService.composeVideo(formData);

      const newJobId = response.jobId;
      setJobId(newJobId);
      setCurrentStep('Processing video...');

      // Poll for job completion
      const pollInterval = setInterval(async () => {
        const isComplete = await pollJobStatus(newJobId);
        if (isComplete) {
          clearInterval(pollInterval);
        }
      }, 2000);

    } catch (error) {
      setIsProcessing(false);
      setError(error.response?.data?.error || 'Failed to start video composition');
      console.error('Video composition error:', error);
    }
  };

  const downloadVideo = async () => {
    if (!outputVideo?.jobId) return;

    try {
      const response = await apiService.downloadVideo(outputVideo.jobId);

      const blob = new Blob([response], { type: 'video/mp4' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `composed_video_${outputVideo.jobId}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to download video');
      console.error('Download error:', error);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography level="h2" sx={{ mb: 3 }}>
        Video Composer
      </Typography>
      <Typography level="body-md" sx={{ mb: 4, color: 'text.secondary' }}>
        Upload videos (any duration), audio, and background music to create a looped composition
      </Typography>

      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Video Files Upload */}
        <Card>
          <CardContent>
            <Typography level="h4" sx={{ mb: 2 }}>
              Video Files (Max 10 files, any duration)
            </Typography>
            
            <Box
              {...getVideosRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isVideosDragActive ? 'primary.main' : 'neutral.300',
                borderRadius: 'md',
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isVideosDragActive ? 'primary.50' : 'background.surface',
                transition: 'all 0.2s'
              }}
            >
              <input {...getVideosInputProps()} />
              <VideoFile sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography level="body-md">
                {isVideosDragActive
                  ? 'Drop video files here...'
                  : 'Drag & drop video files here, or click to select'}
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 1 }}>
                Supported formats: MP4, AVI, MOV, WMV, FLV, WebM
              </Typography>
            </Box>

            {videoFiles.length > 0 && (
              <List sx={{ mt: 2 }}>
                {videoFiles.map((file, index) => (
                  <ListItem key={index}>
                    <ListItemDecorator>
                      <VideoFile />
                    </ListItemDecorator>
                    <ListItemContent>
                      <Typography level="body-sm">{file.name}</Typography>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {formatFileSize(file.size)}
                      </Typography>
                    </ListItemContent>
                    <IconButton
                      size="sm"
                      color="danger"
                      onClick={() => removeVideoFile(index)}
                    >
                      <Delete />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Audio File Upload */}
        <Card>
          <CardContent>
            <Typography level="h4" sx={{ mb: 2 }}>
              Main Audio Track *
            </Typography>
            
            <Box
              {...getAudioRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isAudioDragActive ? 'primary.main' : 'neutral.300',
                borderRadius: 'md',
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isAudioDragActive ? 'primary.50' : 'background.surface',
                transition: 'all 0.2s'
              }}
            >
              <input {...getAudioInputProps()} />
              <AudioFile sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography level="body-md">
                {isAudioDragActive
                  ? 'Drop audio file here...'
                  : 'Drag & drop audio file here, or click to select'}
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 1 }}>
                Supported formats: MP3, WAV, AAC, OGG, M4A
              </Typography>
            </Box>

            {audioFile && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.level1', borderRadius: 'md' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <AudioFile />
                  <Box sx={{ flex: 1 }}>
                    <Typography level="body-sm">{audioFile.name}</Typography>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      {formatFileSize(audioFile.size)}
                    </Typography>
                  </Box>
                  <IconButton size="sm" color="danger" onClick={removeAudioFile}>
                    <Delete />
                  </IconButton>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Background Music Upload */}
        <Card>
          <CardContent>
            <Typography level="h4" sx={{ mb: 2 }}>
              Background Music (Optional)
            </Typography>
            
            <Box
              {...getBgMusicRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isBgMusicDragActive ? 'primary.main' : 'neutral.300',
                borderRadius: 'md',
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isBgMusicDragActive ? 'primary.50' : 'background.surface',
                transition: 'all 0.2s'
              }}
            >
              <input {...getBgMusicInputProps()} />
              <MusicNote sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography level="body-md">
                {isBgMusicDragActive
                  ? 'Drop music file here...'
                  : 'Drag & drop background music here, or click to select'}
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 1 }}>
                Will be looped to match audio duration
              </Typography>
            </Box>

            {bgMusicFile && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.level1', borderRadius: 'md' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <MusicNote />
                  <Box sx={{ flex: 1 }}>
                    <Typography level="body-sm">{bgMusicFile.name}</Typography>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      {formatFileSize(bgMusicFile.size)}
                    </Typography>
                  </Box>
                  <IconButton size="sm" color="danger" onClick={removeBgMusicFile}>
                    <Delete />
                  </IconButton>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardContent>
            <Typography level="h4" sx={{ mb: 3 }}>
              Composition Settings
            </Typography>
            
            <Stack spacing={3}>
              {/* Audio Volume */}
              <FormControl>
                <FormLabel>Audio Volume: {audioVolume}%</FormLabel>
                <Slider
                  value={audioVolume}
                  onChange={(_, value) => setAudioVolume(value)}
                  min={0}
                  max={100}
                  step={5}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 50, label: '50%' },
                    { value: 100, label: '100%' }
                  ]}
                />
              </FormControl>

              {/* Background Music Volume */}
              <FormControl>
                <FormLabel>Background Music Volume: {bgMusicVolume}%</FormLabel>
                <Slider
                  value={bgMusicVolume}
                  onChange={(_, value) => setBgMusicVolume(value)}
                  min={0}
                  max={100}
                  step={5}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 50, label: '50%' },
                    { value: 100, label: '100%' }
                  ]}
                />
              </FormControl>

              {/* Resolution */}
              <FormControl>
                <FormLabel>Output Resolution</FormLabel>
                <Select
                  value={resolution}
                  onChange={(_, value) => setResolution(value)}
                >
                  {resolutionOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </CardContent>
        </Card>

        {/* Processing Status */}
        {isProcessing && (
          <Card>
            <CardContent>
              <Typography level="h4" sx={{ mb: 2 }}>
                Processing Video...
              </Typography>
              <LinearProgress
                determinate
                value={progress}
                sx={{ mb: 2 }}
              />
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                {currentStep} ({progress}%)
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Output Video */}
        {outputVideo && (
          <Card>
            <CardContent>
              <Typography level="h4" sx={{ mb: 2 }}>
                Composed Video Ready
              </Typography>
              
              <Stack spacing={2}>
                <Box>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    Duration: {formatDuration(outputVideo.duration)}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    Resolution: {outputVideo.metadata.resolution}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    Size: {formatFileSize(outputVideo.metadata.size)}
                  </Typography>
                </Box>
                
                <Button
                  startDecorator={<Download />}
                  onClick={downloadVideo}
                  color="primary"
                  size="lg"
                >
                  Download Video
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            size="lg"
            onClick={startComposition}
            disabled={isProcessing || !videoFiles.length || !audioFile}
            loading={isProcessing}
            startDecorator={<PlayArrow />}
          >
            {isProcessing ? 'Processing...' : 'Start Composition'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default VideoComposer;
