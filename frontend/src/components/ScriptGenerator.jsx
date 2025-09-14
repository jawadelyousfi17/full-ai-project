import { useState } from 'react';
import { FileText, Download, Loader2, Clock, Users, Palette, MessageCircle } from 'lucide-react';
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
  Alert
} from '@mui/joy';
import theme from '../theme';

const ScriptGenerator = () => {
  const [formData, setFormData] = useState({
    topic: '',
    duration: 5,
    style: 'educational',
    audience: 'general',
    tone: 'friendly'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({ step: 0, status: 'idle' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setProgress({ step: 0, status: 'loading' });

    const steps = [
      { title: 'Analyzing Topic', description: 'Processing your topic and requirements' },
      { title: 'Generating Script Outline', description: 'Creating chapter structure and flow' },
      { title: 'Writing Content', description: 'Generating detailed script content' },
      { title: 'Finalizing Script', description: 'Formatting and saving the script file' }
    ];

    try {
      // Simulate progress steps
      for (let i = 0; i < steps.length - 1; i++) {
        setProgress({ step: i, status: 'loading' });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setProgress({ step: steps.length - 1, status: 'loading' });
      const response = await apiService.generateScript(formData);
      
      setResult(response.data);
      setProgress({ step: steps.length, status: 'success' });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to generate script');
      setProgress({ step: progress.step, status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const downloadScript = async () => {
    if (!result?.scriptPath) return;
    
    try {
      const filename = result.scriptPath.split('/').pop();
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

  return (
    <CssVarsProvider theme={theme}>
      <Card>
        <CardContent>
          <Stack spacing={4}>
            {/* Header */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ p: 1.5, bgcolor: 'primary.100', borderRadius: 'lg' }}>
                <FileText size={28} style={{ color: 'var(--joy-palette-primary-600)' }} />
              </Box>
              <Box>
                <Typography level="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Script Generator
                </Typography>
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                  Create engaging video scripts with AI assistance
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
                    placeholder="Enter your video topic (e.g., 'The Future of AI Technology')"
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

                {/* Style, Audience, Tone Grid */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                  <FormControl sx={{ flex: 1 }}>
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

                  <FormControl sx={{ flex: 1 }}>
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

                  <FormControl sx={{ flex: 1 }}>
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
                </Stack>

                {/* Generate Button */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || !formData.topic.trim()}
                  loading={loading}
                  startDecorator={loading ? <Loader2 size={20} className="animate-spin" style={{ color: 'currentColor' }} /> : <FileText size={20} />}
                  sx={{ mt: 2 }}
                >
                  {loading ? 'Generating Script...' : 'Generate Script'}
                </Button>
              </Stack>
            </form>

            {/* Progress Indicator */}
            {loading && (
              <Box sx={{ mt: 3 }}>
                <ProgressIndicator 
                  steps={[
                    { title: 'Analyzing Topic', description: 'Processing your topic and requirements' },
                    { title: 'Generating Script Outline', description: 'Creating chapter structure and flow' },
                    { title: 'Writing Content', description: 'Generating detailed script content' },
                    { title: 'Finalizing Script', description: 'Formatting and saving the script file' }
                  ]}
                  currentStep={progress.step}
                  status={progress.status}
                  error={error}
                />
              </Box>
            )}

            {/* Error Display */}
            {error && !loading && (
              <Alert variant="soft" color="danger" sx={{ mt: 3 }}>
                <Typography level="body-md">{error}</Typography>
              </Alert>
            )}

            {/* Success Result */}
            {result && (
              <Card variant="soft" color="success" sx={{ mt: 3 }}>
                <CardContent>
                  <Stack spacing={3}>
                    <Typography level="title-lg" sx={{ fontWeight: 600 }}>
                      🎉 Script Generated Successfully!
                    </Typography>
                    
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Chip variant="soft" size="sm">
                        📄 {result.scriptPath?.split('/').pop()}
                      </Chip>
                      <Chip variant="soft" size="sm">
                        ⏱️ {result.estimatedDuration} min
                      </Chip>
                      <Chip variant="soft" size="sm">
                        📝 {result.wordCount} words
                      </Chip>
                      <Chip variant="soft" size="sm">
                        💾 {Math.round((result.fileSize || 0) / 1024)} KB
                      </Chip>
                    </Stack>
                    
                    {/* Script Preview */}
                    {result.content && (
                      <Box>
                        <Typography level="title-sm" sx={{ mb: 1 }}>
                          Script Preview:
                        </Typography>
                        <Card variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                          <CardContent>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace',
                                lineHeight: 1.5
                              }}
                            >
                              {result.content}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Box>
                    )}
                    
                    <Button
                      variant="solid"
                      color="success"
                      startDecorator={<Download size={16} />}
                      onClick={downloadScript}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Download Script
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

export default ScriptGenerator;
