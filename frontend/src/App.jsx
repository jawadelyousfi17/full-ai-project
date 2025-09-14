import { useState, useEffect } from 'react';
import { Bot, FileText, Volume2, Zap, Files, BarChart3, Wifi, WifiOff } from 'lucide-react';
import ScriptGenerator from './components/ScriptGenerator';
import AudioGenerator from './components/AudioGenerator';
import PipelineGenerator from './components/PipelineGenerator';
import FileManager from './components/FileManager';
import { apiService } from './services/api';
import { CssVarsProvider } from '@mui/joy/styles';
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
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <CssVarsProvider theme={theme}>
      <div className="min-h-screen" style={{ backgroundColor: theme.colorSchemes.light.palette.background.body }}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-primary-600" />
              <h1 className="text-xl font-bold text-gray-900">AI Video Generator</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* API Status */}
              <div className="flex items-center gap-2">
                {apiStatus === 'connected' ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">Connected</span>
                  </>
                ) : apiStatus === 'disconnected' ? (
                  <>
                    <WifiOff className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600">Disconnected</span>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">Checking...</span>
                )}
              </div>

              {/* Stats */}
              {stats && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BarChart3 className="w-4 h-4" />
                  <span>{stats.totalScripts} scripts</span>
                  <span>•</span>
                  <span>{stats.totalAudio} audio</span>
                  <span>•</span>
                  <span>{stats.totalStorageUsed}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {apiStatus === 'disconnected' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-red-500" />
              <p className="text-red-800">
                Unable to connect to the API server. Please ensure the backend is running on port 3000.
              </p>
            </div>
          </div>
        )}
        
        {ActiveComponent && <ActiveComponent />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>AI Video Generator - Powered by Claude AI & FishAudio</p>
          </div>
        </div>
      </footer>
      </div>
    </CssVarsProvider>
  );
}

export default App;
