import { useState, useEffect } from 'react';
import { Files, Download, Trash2, FileText, Volume2, Loader2, RefreshCw, Clock, ArrowUpDown, Play, Pause } from 'lucide-react';
import { apiService } from '../services/api';
import { CssVarsProvider } from '@mui/joy/styles';
import { Button, IconButton, Chip, Typography, Box, Card, CardContent, Stack, Divider } from '@mui/joy';
import theme from '../theme';

const FileManager = () => {
  const [files, setFiles] = useState({ scripts: [], audio: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [sortBy, setSortBy] = useState('date'); // 'date', 'name', 'size'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [playingAudio, setPlayingAudio] = useState(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getFiles();
      setFiles(response.data);
    } catch (err) {
      setError('Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  const sortFiles = (fileList) => {
    return [...fileList].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'date':
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const toggleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDownload = async (type, filename) => {
    try {
      const response = await apiService.downloadFile(type, filename);
      
      // Handle different response types
      let blob;
      if (response.data instanceof Blob) {
        blob = response.data;
      } else {
        // If response is not blob, create blob from data
        const mimeType = type === 'scripts' ? 'text/plain' : 'audio/mpeg';
        blob = new Blob([response.data], { type: mimeType });
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      setError(`Failed to download ${filename}: ${err.response?.data?.message || err.message}`);
    }
  };

  const handlePlayAudio = (filename) => {
    if (playingAudio === filename) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(filename);
    }
  };

  const handleDelete = async (type, filename) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    setDeleting(`${type}-${filename}`);
    try {
      await apiService.deleteFile(type, filename);
      await fetchFiles(); // Refresh the list
    } catch (err) {
      setError('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 2) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const SortButton = ({ sortKey, children }) => (
    <Button
      variant={sortBy === sortKey ? "solid" : "outlined"}
      color={sortBy === sortKey ? "primary" : "neutral"}
      size="sm"
      onClick={() => toggleSort(sortKey)}
      startDecorator={<ArrowUpDown size={14} />}
    >
      {children}
    </Button>
  );

  const FileItem = ({ file, type, icon: Icon, iconColor }) => (
    <Card variant="outlined" sx={{ '&:hover': { boxShadow: 'md' } }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          {/* File Icon */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 'md',
              bgcolor: type === 'audio' ? 'success.50' : 'primary.50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Icon size={20} className={iconColor} />
          </Box>

          {/* File Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography level="title-sm" sx={{ fontWeight: 600 }}>
              {file.name}
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
              <Typography level="body-xs" startDecorator={<Clock size={12} />}>
                {formatDate(file.createdAt)}
              </Typography>
              <Typography level="body-xs" sx={{ fontWeight: 500 }}>
                {formatFileSize(file.size)}
              </Typography>
            </Stack>
          </Box>

          {/* Audio Preview */}
          {type === 'audio' && (
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                variant="soft"
                color="success"
                size="sm"
                onClick={() => handlePlayAudio(file.name)}
              >
                {playingAudio === file.name ? <Pause size={16} /> : <Play size={16} />}
              </IconButton>
              {playingAudio === file.name && (
                <audio
                  controls
                  autoPlay
                  style={{ width: '120px', height: '32px' }}
                  src={`http://localhost:3000/api/download/audio/${file.name}`}
                  onEnded={() => setPlayingAudio(null)}
                />
              )}
            </Stack>
          )}

          {/* Action Buttons */}
          <Stack direction="row" spacing={0.5}>
            <IconButton
              variant="soft"
              color="primary"
              size="sm"
              onClick={() => handleDownload(type, file.name)}
            >
              <Download size={16} />
            </IconButton>
            <IconButton
              variant="soft"
              color="danger"
              size="sm"
              loading={deleting === `${type}-${file.name}`}
              onClick={() => handleDelete(type, file.name)}
              disabled={deleting === `${type}-${file.name}`}
            >
              <Trash2 size={16} />
            </IconButton>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 6 }}>
        <Stack alignItems="center" spacing={2}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <Typography level="body-md" sx={{ color: 'text.secondary' }}>
            Loading your files...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Card variant="soft" color="danger" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ p: 1, bgcolor: 'danger.100', borderRadius: 'md' }}>
              <Files size={20} />
            </Box>
            <Box>
              <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                Error Loading Files
              </Typography>
              <Typography level="body-sm">{error}</Typography>
            </Box>
          </Stack>
          <Button
            variant="solid"
            color="danger"
            startDecorator={<RefreshCw size={16} />}
            onClick={fetchFiles}
            sx={{ alignSelf: 'flex-start' }}
          >
            Try Again
          </Button>
        </Stack>
      </Card>
    );
  }

  // Combine and sort all files, prioritizing audio files
  const sortedAudioFiles = sortFiles(files.audio);
  const sortedScriptFiles = sortFiles(files.scripts);
  const allFiles = [...sortedAudioFiles, ...sortedScriptFiles];

  return (
    <CssVarsProvider theme={theme}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ p: 1.5, bgcolor: 'primary.100', borderRadius: 'lg' }}>
                <Files size={28} className="text-blue-600" />
              </Box>
              <Typography level="h2" sx={{ fontWeight: 700 }}>
                File Manager
              </Typography>
            </Stack>
            <Typography level="body-md" sx={{ color: 'text.secondary' }}>
              Manage your generated scripts and audio files
            </Typography>
          </Box>
          <Button
            variant="soft"
            startDecorator={<RefreshCw size={16} />}
            onClick={fetchFiles}
          >
            Refresh
          </Button>
        </Stack>

        {/* Sort Controls */}
        <Card variant="soft" sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  Sort by:
                </Typography>
                <SortButton sortKey="date">Date</SortButton>
                <SortButton sortKey="name">Name</SortButton>
                <SortButton sortKey="size">Size</SortButton>
              </Stack>
              <Chip variant="soft" size="sm">
                {files.audio.length + files.scripts.length} files total
              </Chip>
            </Stack>
          </CardContent>
        </Card>

        {/* All Files Combined View */}
        {allFiles.length === 0 ? (
          <Card variant="soft" sx={{ textAlign: 'center', py: 6 }}>
            <CardContent>
              <Box sx={{ 
                width: 64, 
                height: 64, 
                bgcolor: 'neutral.100', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}>
                <Files size={32} className="text-gray-400" />
              </Box>
              <Typography level="title-lg" sx={{ mb: 1 }}>
                No files yet
              </Typography>
              <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                Generate some scripts or audio files to see them here
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={4}>
            {/* Audio Files Section (Prioritized) */}
            {sortedAudioFiles.length > 0 && (
              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Box sx={{ p: 1, bgcolor: 'success.100', borderRadius: 'md' }}>
                    <Volume2 size={20} className="text-green-600" />
                  </Box>
                  <Typography level="title-lg" sx={{ fontWeight: 700 }}>
                    Audio Files ({sortedAudioFiles.length})
                  </Typography>
                </Stack>
                <Stack spacing={2}>
                  {sortedAudioFiles.map((file) => (
                    <FileItem
                      key={file.name}
                      file={file}
                      type="audio"
                      icon={Volume2}
                      iconColor="text-green-600"
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Scripts Section */}
            {sortedScriptFiles.length > 0 && (
              <Box>
                {sortedAudioFiles.length > 0 && <Divider sx={{ my: 2 }} />}
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Box sx={{ p: 1, bgcolor: 'primary.100', borderRadius: 'md' }}>
                    <FileText size={20} className="text-blue-600" />
                  </Box>
                  <Typography level="title-lg" sx={{ fontWeight: 700 }}>
                    Scripts ({sortedScriptFiles.length})
                  </Typography>
                </Stack>
                <Stack spacing={2}>
                  {sortedScriptFiles.map((file) => (
                    <FileItem
                      key={file.name}
                      file={file}
                      type="scripts"
                      icon={FileText}
                      iconColor="text-blue-600"
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </CssVarsProvider>
  );
};

export default FileManager;
