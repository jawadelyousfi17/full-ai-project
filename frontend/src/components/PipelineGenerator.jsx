import { useState, useEffect } from 'react';
import { Zap, Download, Loader2, Clock, Users, Palette, MessageCircle, Volume2, FileText, Sparkles } from 'lucide-react';
import { apiService } from '../services/api';
import ProgressIndicator from './ProgressIndicator';
import { CssVarsProvider } from '@mui/joy/styles';
import { 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Stack, 
  Input, 
  Select, 
  Option, 
  FormControl, 
  FormLabel,
  Slider,
  Chip,
  Divider,
  Alert,
  Grid,
  LinearProgress
} from '@mui/joy';
import theme from '../theme';

const PipelineGenerator = () => {
  const [formData, setFormData] = useState({
    topic: '',
    duration: 5,
    style: 'educational',
    audience: 'general',
    tone: 'friendly',
    format: 'mp3',
    voice: '090623498e9843068d8507db5a700f90'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({ step: 0, status: 'idle' });
  const [currentStep, setCurrentStep] = useState(0);
  const [progressSteps, setProgressSteps] = useState([]);

  // Check for existing job on component mount
  useEffect(() => {
    const checkExistingJob = async () => {
      const existingJob = await apiService.checkExistingPipelineJob();
      console.log('🔍 Checking for existing pipeline job:', existingJob);
      
      if (existingJob.exists && existingJob.jobData && !existingJob.jobData.isComplete) {
        console.log('🔄 Resuming pipeline job:', existingJob.jobId);
        // Resume job
        setLoading(true);
        setCurrentStep(2); // Assume we're in progress
        setProgressSteps([
          { label: 'Starting pipeline...', status: 'complete' },
          { label: 'Generating script...', status: 'complete' },
          { label: 'Processing pipeline...', status: 'active', details: 'Reconnecting to job...' },
          { label: 'Finalizing...', status: 'pending' }
        ]);
        
        // Start polling for updates
        pollForJobCompletion(existingJob.jobId);
      } else if (existingJob.exists && existingJob.jobData && existingJob.jobData.isComplete) {
        console.log('✅ Pipeline job completed while away');
        // Job completed while away
        if (existingJob.jobData.result) {
          setResult(existingJob.jobData.result);
        }
        localStorage.removeItem('currentPipelineJob');
      }
    };

    checkExistingJob();
  }, []);

  const pollForJobCompletion = (jobId) => {
    console.log('🔄 Starting polling for pipeline job:', jobId);
    const pollInterval = setInterval(async () => {
      try {
        console.log('📊 Polling pipeline job status for:', jobId);
        const jobData = await apiService.checkJobStatus(jobId);
        console.log('📥 Pipeline poll response:', jobData);
        
        if (jobData.success) {
          const job = jobData.data;
          
          // Update progress
          setProgressSteps(prev => prev.map((step, i) => ({
            ...step,
            details: i === 2 ? `Job ${job.status} (${job.progress}%)` : step.details
          })));
          
          if (job.isComplete) {
            console.log('✅ Pipeline job completed:', job);
            clearInterval(pollInterval);
            setLoading(false);
            localStorage.removeItem('currentPipelineJob');
            
            if (job.result) {
              setResult(job.result);
              setCurrentStep(4);
              setProgressSteps(prev => prev.map(step => ({ ...step, status: 'complete' })));
            } else {
              setError(job.error || 'Pipeline job failed');
              setCurrentStep(-1);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Pipeline polling error:', error.message);
      }
    }, 2000);

    // Stop polling after 30 minutes
    setTimeout(() => {
      console.log('⏰ Pipeline polling timeout for job:', jobId);
      clearInterval(pollInterval);
      setLoading(false);
      localStorage.removeItem('currentPipelineJob');
      setError('Pipeline job polling timeout');
    }, 30 * 60 * 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Pipeline generation form submitted');
    setLoading(true);
    setError('');
    setResult(null);
    setCurrentStep(0);

    try {
      console.log('📝 Pipeline data prepared:', formData);

      const response = await apiService.generateScriptToAudioWithProgress(formData, (progressData) => {
        console.log('📊 Pipeline progress callback received:', progressData);
        
        // Store job ID when received
        if (progressData.jobId) {
          console.log('💾 Storing pipeline job ID:', progressData.jobId);
          localStorage.setItem('currentPipelineJob', progressData.jobId);
        }

        switch (progressData.type) {
          case 'pipeline_start':
            setCurrentStep(0);
            setProgressSteps([
              { 
                label: 'Starting pipeline...', 
                status: 'active',
                details: progressData.message
              },
              { label: 'Generating script...', status: 'pending' },
              { label: 'Generating audio...', status: 'pending' },
              { label: 'Finalizing...', status: 'pending' }
            ]);
            break;

          case 'script_generation':
            setCurrentStep(1);
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              status: i === 0 ? 'complete' : i === 1 ? 'active' : 'pending',
              details: i === 1 ? progressData.message : step.details
            })));
            break;

          case 'script_complete':
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              status: i < 2 ? 'complete' : i === 2 ? 'pending' : 'pending',
              details: i === 1 ? `Script generated (${progressData.scriptData?.wordCount} words)` : step.details
            })));
            break;

          case 'audio_start':
            setCurrentStep(2);
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              status: i < 2 ? 'complete' : i === 2 ? 'active' : 'pending',
              details: i === 2 ? progressData.message : step.details
            })));
            break;

          case 'audio_progress':
          case 'chunk_start':
          case 'chunk_complete':
          case 'single_chunk':
          case 'combining':
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              details: i === 2 ? 
                progressData.message || `Audio progress: ${progressData.progress || 0}%` : 
                step.details
            })));
            break;

          case 'complete':
            setCurrentStep(4);
            setProgressSteps(prev => prev.map(step => ({ 
              ...step, 
              status: 'complete'
            })));
            break;
        }
      });
      
      if (response) {
        console.log('✅ Final pipeline response received:', response);
        setResult(response);
        setCurrentStep(4); // Mark as complete
        setProgressSteps(prev => prev.map(step => ({ ...step, status: 'complete' })));
        localStorage.removeItem('currentPipelineJob'); // Clear job on completion
      }
    } catch (err) {
      console.error('❌ Pipeline generation error:', err);
      setError(err.message);
      setCurrentStep(-1); // Mark as error
      localStorage.removeItem('currentPipelineJob'); // Clear job on error
    } finally {
      console.log('🏁 Pipeline generation process finished');
      setLoading(false);
    }
  };

  const downloadScript = async () => {
    if (!result?.script?.scriptPath) return;
    
    try {
      const filename = result.script.scriptPath.split('/').pop();
      const response = await apiService.downloadFile('scripts', filename);
      
      // Handle different response types
      let blob;
      if (response.data instanceof Blob) {
        blob = response.data;
      } else {
        // If response is text, create blob from text
        blob = new Blob([response.data], { type: 'text/plain' });
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
      alert('Failed to download script: ' + (error.response?.data?.message || error.message));
    }
  };

  const downloadAudio = async () => {
    if (!result?.audio?.outputPath) return;
    
    try {
      const filename = result.audio.outputPath.split('/').pop();
      const response = await apiService.downloadFile('audio', filename);
      
      // Handle different response types
      let blob;
      if (response.data instanceof Blob) {
        blob = response.data;
      } else {
        // If response is not blob, create blob from data
        blob = new Blob([response.data], { type: `audio/${result.audio.format || 'wav'}` });
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
          <Stack spacing={4}>
            {/* Header */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ p: 1.5, bgcolor: 'warning.100', borderRadius: 'lg' }}>
                <Zap size={28} style={{ color: 'var(--joy-palette-warning-600)' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography level="h2" sx={{ fontWeight: 700 }}>
                    Complete Pipeline
                  </Typography>
                  <Chip variant="soft" color="warning" size="sm" startDecorator={<Sparkles size={14} />}>
                    Script + Audio
                  </Chip>
                </Stack>
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                  Generate both script and audio in one seamless workflow
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <form onSubmit={handleSubmit}>
              <Stack spacing={4}>
                {/* Topic Input */}
                <FormControl required>
                  <FormLabel sx={{ fontWeight: 600 }}>Video Topic</FormLabel>
                  <Input
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="Enter your video topic (e.g., 'Climate Change Solutions')"
                    size="lg"
                    startDecorator={<FileText size={18} />}
                  />
                </FormControl>

                {/* Duration Slider */}
                <FormControl>
                  <FormLabel sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Clock size={16} />
                    Duration: {formData.duration} minutes
                  </FormLabel>
                  <Box sx={{ px: 2 }}>
                    <Slider
                      value={formData.duration}
                      onChange={(e, value) => setFormData({ ...formData, duration: value })}
                      min={1}
                      max={30}
                      step={1}
                      marks={[
                        { value: 1, label: '1min' },
                        { value: 5, label: '5min' },
                        { value: 10, label: '10min' },
                        { value: 20, label: '20min' },
                        { value: 30, label: '30min' }
                      ]}
                      sx={{ mt: 2 }}
                    />
                  </Box>
                </FormControl>

                {/* Content Settings */}
                <Card variant="soft" sx={{ p: 3 }}>
                  <Typography level="title-md" sx={{ mb: 2, fontWeight: 600 }}>
                    📝 Content Settings
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid xs={12} md={4}>
                      <FormControl>
                        <FormLabel sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Palette size={16} />
                          Style
                        </FormLabel>
                        <Select
                          value={formData.style}
                          onChange={(e, value) => setFormData({ ...formData, style: value })}
                        >
                          <Option value="educational">📚 Educational</Option>
                          <Option value="entertaining">🎭 Entertaining</Option>
                          <Option value="documentary">🎬 Documentary</Option>
                          <Option value="tutorial">🛠️ Tutorial</Option>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid xs={12} md={4}>
                      <FormControl>
                        <FormLabel sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Users size={16} />
                          Audience
                        </FormLabel>
                        <Select
                          value={formData.audience}
                          onChange={(e, value) => setFormData({ ...formData, audience: value })}
                        >
                          <Option value="general">👥 General</Option>
                          <Option value="children">🧒 Children</Option>
                          <Option value="adults">👨‍💼 Adults</Option>
                          <Option value="professionals">🎓 Professionals</Option>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid xs={12} md={4}>
                      <FormControl>
                        <FormLabel sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MessageCircle size={16} />
                          Tone
                        </FormLabel>
                        <Select
                          value={formData.tone}
                          onChange={(e, value) => setFormData({ ...formData, tone: value })}
                        >
                          <Option value="friendly">😊 Friendly</Option>
                          <Option value="formal">🎩 Formal</Option>
                          <Option value="casual">😎 Casual</Option>
                          <Option value="professional">💼 Professional</Option>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Card>

                {/* Audio Settings */}
                <Card variant="soft" sx={{ p: 3 }}>
                  <Typography level="title-md" sx={{ mb: 2, fontWeight: 600 }}>
                    🎵 Audio Settings
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid xs={12} md={6}>
                      <FormControl>
                        <FormLabel sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Volume2 size={16} />
                          Audio Format
                        </FormLabel>
                        <Select
                          value={formData.format}
                          onChange={(e, value) => setFormData({ ...formData, format: value })}
                        >
                          <Option value="mp3">🎵 MP3 (Recommended)</Option>
                          <Option value="wav">🎶 WAV (High Quality)</Option>
                          <Option value="flac">🎼 FLAC (Lossless)</Option>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid xs={12} md={6}>
                      <FormControl>
                        <FormLabel sx={{ fontWeight: 600 }}>Voice Model</FormLabel>
                        <Select
                          value={formData.voice}
                          onChange={(e, value) => setFormData({ ...formData, voice: value })}
                        >
                          <Option value="090623498e9843068d8507db5a700f90">🎤 Custom Voice (Default)</Option>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Card>

                {/* Generate Button */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || !formData.topic.trim()}
                  loading={loading}
                  startDecorator={loading ? <Loader2 size={20} className="animate-spin" style={{ color: 'currentColor' }} /> : <Zap size={20} />}
                  sx={{ 
                    mt: 2,
                    background: 'linear-gradient(45deg, #FF6B35, #F7931E)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #E55A2B, #E8841A)',
                    }
                  }}
                >
                  {loading ? 'Generating Script & Audio...' : 'Generate Complete Pipeline'}
                </Button>
              </Stack>
            </form>

            {/* Progress Indicator */}
            {loading && (
              <Card variant="soft" color="primary" sx={{ mt: 3 }}>
                <CardContent>
                  <ProgressIndicator 
                    steps={[
                      { title: 'Analyzing Topic', description: 'Processing your topic and requirements' },
                      { title: 'Generating Script', description: 'Creating detailed script content' },
                      { title: 'Processing Text for Audio', description: 'Preparing script for voice synthesis' },
                      { title: 'Generating Audio', description: 'Converting script to high-quality audio' },
                      { title: 'Finalizing Files', description: 'Saving script and audio files' }
                    ]}
                    currentStep={progress.step}
                    status={progress.status}
                    error={error}
                  />
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {error && !loading && (
              <Alert color="danger" variant="soft" sx={{ mt: 3 }}>
                <Typography level="body-md">{error}</Typography>
              </Alert>
            )}

            {/* Success Results */}
            {result && (
              <Alert color="success" variant="soft" sx={{ mt: 3 }}>
                <Stack spacing={3}>
                  <Typography level="title-md" sx={{ fontWeight: 600 }}>
                    🎉 Pipeline Completed Successfully!
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {/* Script Details */}
                    <Grid xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography level="title-sm" sx={{ mb: 2, fontWeight: 600 }}>
                            📄 Script Generated
                          </Typography>
                          <Stack spacing={1}>
                            <Typography level="body-sm">
                              <strong>File:</strong> {result.script?.scriptPath}
                            </Typography>
                            <Typography level="body-sm">
                              <strong>Duration:</strong> {result.script?.estimatedDuration} minutes
                            </Typography>
                            <Typography level="body-sm">
                              <strong>Words:</strong> {result.script?.wordCount}
                            </Typography>
                          </Stack>
                          
                          {/* Script Preview */}
                          {result.script?.content && (
                            <Box sx={{ mt: 2 }}>
                              <Typography level="body-sm" sx={{ fontWeight: 600, mb: 1 }}>
                                Preview:
                              </Typography>
                              <Card variant="soft" sx={{ p: 2, maxHeight: 120, overflow: 'auto' }}>
                                <Typography level="body-xs" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                  {result.script.content.substring(0, 300)}...
                                </Typography>
                              </Card>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Audio Details */}
                    <Grid xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography level="title-sm" sx={{ mb: 2, fontWeight: 600 }}>
                            🎵 Audio Generated
                          </Typography>
                          <Stack spacing={1}>
                            <Typography level="body-sm">
                              <strong>File:</strong> {result.audio?.outputPath}
                            </Typography>
                            <Typography level="body-sm">
                              <strong>Duration:</strong> {result.audio?.estimatedDuration} minutes
                            </Typography>
                            <Typography level="body-sm">
                              <strong>Size:</strong> {formatFileSize(result.audio?.fileSize || 0)}
                            </Typography>
                          </Stack>
                          
                          {/* Audio Preview */}
                          {result.audio?.outputPath && (
                            <Box sx={{ mt: 2 }}>
                              <Typography level="body-sm" sx={{ fontWeight: 600, mb: 1 }}>
                                Preview:
                              </Typography>
                              <audio 
                                controls 
                                style={{ width: '100%' }}
                                src={`/api/download/audio/${result.audio.outputPath.split('/').pop()}`}
                              >
                                Your browser does not support the audio element.
                              </audio>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Download Buttons */}
                  <Stack direction="row" spacing={2}>
                    <Button
                      onClick={downloadScript}
                      startDecorator={<Download size={16} />}
                      variant="solid"
                      color="primary"
                    >
                      Download Script
                    </Button>
                    <Button
                      onClick={downloadAudio}
                      startDecorator={<Download size={16} />}
                      variant="outlined"
                      color="primary"
                    >
                      Download Audio
                    </Button>
                  </Stack>
                </Stack>
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </CssVarsProvider>
  );
};

export default PipelineGenerator;
