import { useState, useEffect } from 'react';
import { Volume2, Download, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';
import ProgressIndicator from './ProgressIndicator';
import { CssVarsProvider } from '@mui/joy/styles';
import { Button, Card, CardContent, Typography, Box, Stack, Textarea, Select, Option, FormControl, FormLabel } from '@mui/joy';
import theme from '../theme';

const AudioGenerator = () => {
  const [formData, setFormData] = useState({
    text: '',
    format: 'mp3',
    voice: 'default'
  });
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({ step: 0, status: 'idle' });
  const [currentStep, setCurrentStep] = useState(0);
  const [progressSteps, setProgressSteps] = useState([]);

  // Fetch available voices on component mount
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const voicesData = await apiService.getVoices();
        if (voicesData.success && voicesData.data.voices) {
          setVoices(voicesData.data.voices);
          // Set default voice if available
          if (voicesData.data.default) {
            setFormData(prev => ({ ...prev, voice: voicesData.data.default }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
      }
    };
    
    fetchVoices();
  }, []);

  // Check for existing job on component mount
  useEffect(() => {
    const checkExistingJob = async () => {
      const existingJobId = localStorage.getItem('currentAudioJob');
      console.log('Checking for existing job:', existingJobId);
      
      if (existingJobId) {
        try {
          console.log('Checking job status for:', existingJobId);
          const jobData = await apiService.checkJobStatus(existingJobId);
          console.log('Job status response:', jobData);
          
          if (jobData.success && !jobData.data.isComplete) {
            console.log('Resuming job:', existingJobId);
            // Resume job
            setLoading(true);
            setCurrentStep(2); // Assume we're in progress
            setProgressSteps([
              { label: 'Starting audio generation...', status: 'complete' },
              { label: 'Processing segments...', status: 'complete' },
              { label: 'Generating audio...', status: 'active', details: 'Reconnecting to job...' },
              { label: 'Finalizing...', status: 'pending' }
            ]);
            
            // Start polling for updates
            pollForJobCompletion(existingJobId);
          } else if (jobData.success && jobData.data.isComplete) {
            console.log('Job completed while away');
            // Job completed while away
            if (jobData.data.result) {
              setResult(jobData.data.result);
            }
            localStorage.removeItem('currentAudioJob');
          }
        } catch (error) {
          console.log('Job check failed:', error);
          // Job not found, clear localStorage
          localStorage.removeItem('currentAudioJob');
        }
      }
    };

    checkExistingJob();
  }, []);

  const pollForJobCompletion = (jobId) => {
    console.log('Starting polling for job:', jobId);
    const pollInterval = setInterval(async () => {
      try {
        console.log('Polling job status for:', jobId);
        const jobData = await apiService.checkJobStatus(jobId);
        console.log('Poll response:', jobData);
        
        if (jobData.success) {
          const job = jobData.data;
          
          // Update progress
          setProgressSteps(prev => prev.map((step, i) => ({
            ...step,
            details: i === 2 ? `Job ${job.status} (${job.progress}%)` : step.details
          })));
          
          if (job.isComplete) {
            console.log('Job completed:', job);
            clearInterval(pollInterval);
            setLoading(false);
            localStorage.removeItem('currentAudioJob');
            
            if (job.result) {
              setResult(job.result);
              setCurrentStep(4);
              setProgressSteps(prev => prev.map(step => ({ ...step, status: 'complete' })));
            } else {
              setError(job.error || 'Job failed');
              setCurrentStep(-1);
            }
          }
        }
      } catch (error) {
        console.warn('Polling error:', error.message);
      }
    }, 2000);

    // Stop polling after 30 minutes
    setTimeout(() => {
      console.log('Polling timeout for job:', jobId);
      clearInterval(pollInterval);
      setLoading(false);
      localStorage.removeItem('currentAudioJob');
      setError('Job polling timeout');
    }, 30 * 60 * 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Audio generation form submitted');
    setLoading(true);
    setError('');
    setResult(null);
    setCurrentStep(0);

    // Initialize with basic steps - will be updated by progress callbacks
    setProgressSteps([
      { label: 'Preparing audio generation...', status: 'pending' },
      { label: 'Processing segments...', status: 'pending' },
      { label: 'Generating audio...', status: 'pending' },
      { label: 'Finalizing...', status: 'pending' }
    ]);

    try {
      const audioData = {
        text: formData.text,
        file: formData.file,
        format: formData.format,
        voice: formData.voice
      };

      console.log('📝 Audio data prepared:', audioData);

      const response = await apiService.generateAudioWithProgress(audioData, (progressData) => {
        console.log('📊 Progress callback received:', progressData);
        // Store job ID when received
        if (progressData.jobId) {
          console.log('Storing job ID:', progressData.jobId);
          localStorage.setItem('currentAudioJob', progressData.jobId);
        }
        
        // Handle polling updates and all progress types that should show chunk progress
        if (progressData.type === 'polling_update' || progressData.type === 'chunk_start' || progressData.type === 'chunk_complete' || progressData.type === 'single_chunk') {
          setCurrentStep(2);
          setProgressSteps(prev => prev.map((step, i) => ({
            ...step,
            status: i < 2 ? 'complete' : i === 2 ? 'active' : 'pending',
            label: i === 2 ? 'Generating audio...' : step.label,
            details: i === 2 ? progressData.message : step.details
          })));
          return;
        }
        
        switch (progressData.type) {
          case 'start':
            setCurrentStep(0);
            setProgressSteps([
              { 
                label: 'Starting audio generation...', 
                status: 'active',
                details: progressData.message || `Processing ${progressData.textLength || 'text'} characters`
              },
              { label: 'Processing segments...', status: 'pending' },
              { label: 'Generating audio...', status: 'pending' },
              { label: 'Finalizing...', status: 'pending' }
            ]);
            break;

          case 'chunks_created':
            setCurrentStep(1);
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              status: i === 0 ? 'complete' : i === 1 ? 'active' : 'pending',
              details: i === 1 ? `Split into ${progressData.totalChunks} segments` : step.details
            })));
            break;

          case 'chunk_start':
            setCurrentStep(2);
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              status: i < 2 ? 'complete' : i === 2 ? 'active' : 'pending',
              details: i === 2 ? 
                progressData.message || `Processing audio chunk ${progressData.chunkIndex + 1} of ${progressData.totalChunks}` : 
                step.details
            })));
            break;

          case 'chunk_complete':
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              details: i === 2 ? 
                progressData.message || `Completed audio chunk ${progressData.chunkIndex + 1} of ${progressData.totalChunks} (${progressData.progress}%)` : 
                step.details
            })));
            break;

          case 'single_chunk':
            setCurrentStep(2);
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              status: i < 2 ? 'complete' : i === 2 ? 'active' : 'pending',
              details: i === 2 ? 
                progressData.message || 'Generating audio (1 chunk)...' : 
                step.details
            })));
            break;

          case 'audio_progress':
            // Handle generic audio progress updates
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              details: i === 2 ? 
                progressData.message || `Audio progress: ${progressData.progress || 0}%` : 
                step.details
            })));
            break;

          case 'combining':
            setCurrentStep(3);
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              status: i < 3 ? 'complete' : i === 3 ? 'active' : 'pending',
              details: i === 3 ? 
                progressData.message || `Combining ${progressData.totalChunks || 'audio'} segments...` : 
                step.details
            })));
            break;

          case 'complete':
            setCurrentStep(4);
            setProgressSteps(prev => prev.map(step => ({ 
              ...step, 
              status: 'complete',
              details: step.details
            })));
            break;
        }
      });
      
      if (response) {
        console.log('✅ Final response received:', response);
        setResult(response);
        setCurrentStep(4); // Mark as complete
        setProgressSteps(prev => prev.map(step => ({ ...step, status: 'complete' })));
        localStorage.removeItem('currentAudioJob'); // Clear job on completion
      }
    } catch (err) {
      console.error('❌ Audio generation error:', err);
      setError(err.message);
      setCurrentStep(-1); // Mark as error
      localStorage.removeItem('currentAudioJob'); // Clear job on error
    } finally {
      console.log('🏁 Audio generation process finished');
      setLoading(false);
    }
  };

  const downloadAudio = async () => {
    if (!result?.outputPath) return;
    
    try {
      const filename = result.outputPath.split('/').pop();
      const response = await apiService.downloadFile('audio', filename);
      
      // Handle different response types
      let blob;
      if (response.data instanceof Blob) {
        blob = response.data;
      } else {
        // If response is not blob, create blob from data
        blob = new Blob([response.data], { type: `audio/${result.format || 'wav'}` });
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download audio: ' + (error.response?.data?.message || error.message));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <CssVarsProvider theme={theme}>
      <Card>
        <CardContent>
          <Stack spacing={3}>
            {/* Header */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ p: 1.5, bgcolor: 'primary.100', borderRadius: 'md' }}>
                <Volume2 size={24} style={{ color: 'var(--joy-palette-primary-600)' }} />
              </Box>
              <Typography level="h3" sx={{ fontWeight: 700 }}>
                Audio Generator
              </Typography>
            </Stack>

            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                {/* Text Input */}
                <FormControl>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <FormLabel sx={{ flex: 1 }}>Text to Convert</FormLabel>
                    
                    {/* Generate Button with Progress */}
                    <Button
                      type="submit"
                      size="sm"
                      disabled={loading || !formData.text.trim()}
                      startDecorator={loading ? <Loader2 size={16} className="animate-spin" style={{ color: 'currentColor' }} /> : <Volume2 size={16} />}
                      sx={{ 
                        minWidth: '140px',
                        background: 'linear-gradient(135deg, var(--joy-palette-primary-500), var(--joy-palette-primary-600))',
                        '&:hover': {
                          background: 'linear-gradient(135deg, var(--joy-palette-primary-600), var(--joy-palette-primary-700))'
                        }
                      }}
                    >
                      {loading ? 'Generating...' : 'Generate Audio'}
                    </Button>
                  </Stack>
                  
                  {/* Real-time Progress Display */}
                  {loading && progressSteps.length > 0 && (
                    <Box sx={{ 
                      mb: 2, 
                      p: 2, 
                      bgcolor: 'primary.50', 
                      borderRadius: 'md',
                      border: '1px solid',
                      borderColor: 'primary.200'
                    }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--joy-palette-primary-600)' }} />
                        <Stack spacing={0.5} sx={{ flex: 1 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 600, color: 'primary.700' }}>
                            Audio Generation Progress
                          </Typography>
                          {progressSteps.map((step, index) => (
                            step.status === 'active' && (
                              <Stack key={index} spacing={0.5}>
                                <Typography 
                                  level="body-xs" 
                                  sx={{ 
                                    color: 'primary.700',
                                    fontWeight: 600,
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {step.label}
                                </Typography>
                                {step.details && (
                                  <Typography 
                                    level="body-xs" 
                                    sx={{ 
                                      color: 'primary.600',
                                      fontFamily: 'monospace',
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    {step.details}
                                  </Typography>
                                )}
                              </Stack>
                            )
                          ))}
                        </Stack>
                      </Stack>
                    </Box>
                  )}
                  
                  <Textarea
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    placeholder="Enter the text you want to convert to audio..."
                    minRows={6}
                    required
                  />
                </FormControl>

                {/* Format and Voice Selection */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>Audio Format</FormLabel>
                    <Select
                      value={formData.format}
                      onChange={(e, value) => setFormData({ ...formData, format: value })}
                    >
                      <Option value="mp3">MP3</Option>
                      <Option value="wav">WAV</Option>
                      <Option value="flac">FLAC</Option>
                    </Select>
                  </FormControl>

                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>Voice Model</FormLabel>
                    <Select
                      value={formData.voice}
                      onChange={(e, value) => setFormData({ ...formData, voice: value })}
                    >
                      {voices.map((voice) => (
                        <Option key={voice.id} value={voice.id}>
                          {voice.name}
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

              </Stack>
            </form>

            {/* Error Display */}
            {error && !loading && (
              <Card variant="soft" color="danger" sx={{ mt: 3 }}>
                <CardContent>
                  <Typography level="body-md">{error}</Typography>
                </CardContent>
              </Card>
            )}

            {/* Success Result */}
            {result && (
              <Card variant="soft" color="success" sx={{ mt: 3 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography level="title-md" sx={{ fontWeight: 600 }}>
                      Audio Generated Successfully!
                    </Typography>
                    
                    <Stack spacing={1}>
                      <Typography level="body-sm"><strong>File:</strong> {result.outputPath}</Typography>
                      <Typography level="body-sm"><strong>Duration:</strong> {result.estimatedDuration} minutes</Typography>
                      <Typography level="body-sm"><strong>File Size:</strong> {formatFileSize(result.fileSize || 0)}</Typography>
                      <Typography level="body-sm"><strong>Format:</strong> {result.format}</Typography>
                    </Stack>
                    
                    {/* Audio Preview */}
                    <Box>
                      <Typography level="title-sm" sx={{ mb: 1 }}>Audio Preview:</Typography>
                      <audio 
                        controls 
                        style={{ width: '100%' }}
                        src={`/api/download/audio/${result.outputPath.split('/').pop()}`}
                      >
                        Your browser does not support the audio element.
                      </audio>
                    </Box>
                    
                    <Button
                      variant="solid"
                      color="success"
                      startDecorator={<Download size={16} />}
                      onClick={downloadAudio}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Download Audio
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </CardContent>
      </Card>
    </CssVarsProvider>
  );
};

export default AudioGenerator;
