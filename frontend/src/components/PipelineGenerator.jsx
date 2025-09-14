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
            setProgressSteps(prev => prev.map((step, i) => ({
              ...step,
              details: i === 2 ? `${progressData.message} (${progressData.progress}%)` : step.details
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
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-6 h-6 text-primary-600" />
        <h2 className="text-2xl font-bold text-gray-900">Complete Pipeline</h2>
        <span className="text-sm bg-primary-100 text-primary-800 px-2 py-1 rounded-full">
          Script + Audio
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
            Topic *
          </label>
          <input
            type="text"
            id="topic"
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            className="input-field"
            placeholder="Enter your video topic..."
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              min="1"
              max="120"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="style" className="block text-sm font-medium text-gray-700 mb-2">
              Style
            </label>
            <select
              id="style"
              value={formData.style}
              onChange={(e) => setFormData({ ...formData, style: e.target.value })}
              className="select-field"
            >
              <option value="educational">Educational</option>
              <option value="entertaining">Entertaining</option>
              <option value="documentary">Documentary</option>
              <option value="tutorial">Tutorial</option>
            </select>
          </div>

          <div>
            <label htmlFor="audience" className="block text-sm font-medium text-gray-700 mb-2">
              Audience
            </label>
            <select
              id="audience"
              value={formData.audience}
              onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              className="select-field"
            >
              <option value="general">General</option>
              <option value="children">Children</option>
              <option value="adults">Adults</option>
              <option value="professionals">Professionals</option>
            </select>
          </div>

          <div>
            <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-2">
              Tone
            </label>
            <select
              id="tone"
              value={formData.tone}
              onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              className="select-field"
            >
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
              <option value="professional">Professional</option>
            </select>
          </div>

          <div>
            <label htmlFor="format" className="block text-sm font-medium text-gray-700 mb-2">
              Audio Format
            </label>
            <select
              id="format"
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value })}
              className="select-field"
            >
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="flac">FLAC</option>
            </select>
          </div>

          <div>
            <label htmlFor="voice" className="block text-sm font-medium text-gray-700 mb-2">
              Voice Model
            </label>
            <select
              id="voice"
              value={formData.voice}
              onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
              className="select-field"
            >
              <option value="090623498e9843068d8507db5a700f90">Custom Voice (Default)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !formData.topic.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Script & Audio...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate Script & Audio
            </>
          )}
        </button>
      </form>

      {loading && (
        <div className="mt-6">
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
        </div>
      )}

      {error && !loading && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">Pipeline Completed Successfully!</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Script Details */}
            <div className="bg-white p-3 rounded border">
              <h4 className="font-medium text-gray-900 mb-2">Script Generated</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p><strong>File:</strong> {result.script?.scriptPath}</p>
                <p><strong>Duration:</strong> {result.script?.estimatedDuration} minutes</p>
                <p><strong>Words:</strong> {result.script?.wordCount}</p>
              </div>
              
              {/* Script Preview */}
              {result.script?.content && (
                <div className="mt-3">
                  <h5 className="font-medium text-gray-800 mb-1">Preview:</h5>
                  <div className="bg-gray-50 p-2 rounded text-xs max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{result.script.content.substring(0, 300)}...</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Details */}
            <div className="bg-white p-3 rounded border">
              <h4 className="font-medium text-gray-900 mb-2">Audio Generated</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p><strong>File:</strong> {result.audio?.outputPath}</p>
                <p><strong>Duration:</strong> {result.audio?.estimatedDuration} minutes</p>
                <p><strong>Size:</strong> {result.audio?.fileSize} bytes</p>
              </div>
              
              {/* Audio Preview */}
              {result.audio?.outputPath && (
                <div className="mt-3">
                  <h5 className="font-medium text-gray-800 mb-1">Preview:</h5>
                  <audio 
                    controls 
                    className="w-full"
                    src={`/api/download/audio/${result.audio.outputPath.split('/').pop()}`}
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={downloadScript}
              className="btn-primary"
            >
              <Download className="w-4 h-4" />
              Download Script
            </button>
            <button
              onClick={downloadAudio}
              className="btn-secondary"
            >
              <Download className="w-4 h-4" />
              Download Audio
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineGenerator;
