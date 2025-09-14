import { useState, useEffect } from 'react';
import { Bot, FileText, Volume2, Zap, Files, BarChart3, Wifi, WifiOff, Sparkles, History } from 'lucide-react';
import ScriptGenerator from './components/ScriptGenerator';
import AudioGenerator from './components/AudioGenerator';
import PipelineGenerator from './components/PipelineGenerator';
import FileManager from './components/FileManager';
import PipelineHistory from './components/PipelineHistory';
import { apiService } from './services/api';
import { CssVarsProvider } from '@mui/joy/styles';
import { 
  Box, 
  Container, 
  Typography, 
  Tabs, 
  TabList, 
  Tab, 
  TabPanel,
  Card,
  CardContent,
  Stack,
  Chip,
  Alert,
  Divider
} from '@mui/joy';
import theme from './theme';

function App() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [apiStatus, setApiStatus] = useState('checking');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    checkApiHealth();
    fetchStats();
  }, []);

  const checkApiHealth = async () => {
    try {
      await apiService.getHealth();
      setApiStatus('connected');
    } catch (error) {
      setApiStatus('disconnected');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const tabs = [
    { id: 'pipeline', label: 'Complete Pipeline', icon: Zap, component: PipelineGenerator },
    { id: 'script', label: 'Script Generator', icon: FileText, component: ScriptGenerator },
    { id: 'audio', label: 'Audio Generator', icon: Volume2, component: AudioGenerator },
    { id: 'files', label: 'File Manager', icon: Files, component: FileManager },
    { id: 'history', label: 'Pipeline History', icon: History, component: PipelineHistory },
  ];

  return (
    <CssVarsProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.body' }}>
        {/* Header */}
        <Card variant="outlined" sx={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <CardContent>
            <Container maxWidth="xl">
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1 }}>
                {/* Logo and Title */}
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ p: 1.5, bgcolor: 'primary.100', borderRadius: 'lg' }}>
                    <Bot size={32} className="text-blue-600" />
                  </Box>
                  <Stack>
                    <Typography level="h3" sx={{ fontWeight: 700, background: 'linear-gradient(45deg, #2563eb, #7c3aed)', backgroundClip: 'text', color: 'transparent' }}>
                      AI Video Generator
                    </Typography>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      Create professional video content with AI
                    </Typography>
                  </Stack>
                </Stack>
                
                {/* Status and Stats */}
                <Stack direction="row" alignItems="center" spacing={3}>
                  {/* API Status */}
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {apiStatus === 'connected' ? (
                      <>
                        <Wifi size={16} style={{ color: 'var(--joy-palette-success-500)' }} />
                        <Chip variant="soft" color="success" size="sm">Connected</Chip>
                      </>
                    ) : apiStatus === 'disconnected' ? (
                      <>
                        <WifiOff size={16} style={{ color: 'var(--joy-palette-danger-500)' }} />
                        <Chip variant="soft" color="danger" size="sm">Disconnected</Chip>
                      </>
                    ) : (
                      <Chip variant="soft" color="neutral" size="sm">Checking...</Chip>
                    )}
                  </Stack>

                  {/* Stats */}
                  {stats && (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <BarChart3 size={16} style={{ color: 'var(--joy-palette-text-secondary)' }} />
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        {stats.totalScripts} scripts • {stats.totalAudio} audio • {stats.totalStorageUsed}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </Container>
          </CardContent>
        </Card>

        {/* Navigation */}
        <Container maxWidth="xl" sx={{ mt: 2 }}>
          <Tabs value={activeTab} onChange={(event, newValue) => setActiveTab(newValue)}>
            <TabList
              variant="soft"
              sx={{
                bgcolor: 'background.surface',
                borderRadius: 'lg',
                p: 0.5,
                boxShadow: 'sm'
              }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Tab
                    key={tab.id}
                    value={tab.id}
                    sx={{
                      flexDirection: 'row',
                      gap: 1,
                      fontWeight: 600,
                      '&[aria-selected="true"]': {
                        bgcolor: 'primary.500',
                        color: 'primary.50',
                        '&:hover': {
                          bgcolor: 'primary.600',
                        }
                      }
                    }}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </Tab>
                );
              })}
            </TabList>

            {/* Main Content */}
            <Box sx={{ mt: 4 }}>
              {apiStatus === 'disconnected' && (
                <Alert color="danger" variant="soft" sx={{ mb: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <WifiOff size={20} />
                    <Typography level="body-md">
                      Unable to connect to the API server. Please ensure the backend is running on port 3000.
                    </Typography>
                  </Stack>
                </Alert>
              )}
              
              {tabs.map((tab) => (
                <TabPanel key={tab.id} value={tab.id} sx={{ p: 0 }}>
                  <tab.component />
                </TabPanel>
              ))}
            </Box>
          </Tabs>
        </Container>

        {/* Footer */}
        <Box sx={{ mt: 8, py: 4, borderTop: 1, borderColor: 'divider' }}>
          <Container maxWidth="xl">
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
              <Sparkles size={16} style={{ color: 'var(--joy-palette-primary-500)' }} />
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                AI Video Generator - Powered by Claude AI & FishAudio
              </Typography>
            </Stack>
          </Container>
        </Box>
      </Box>
    </CssVarsProvider>
  );
}

export default App;
