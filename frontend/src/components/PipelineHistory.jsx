import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Input,
  Select,
  Option,
  Grid,
  Stack,
  Chip,
  IconButton,
  Modal,
  ModalDialog,
  ModalClose,
  Divider,
  LinearProgress,
  Alert,
  Tooltip,
  Badge
} from '@mui/joy';
import {
  Search,
  FilterList,
  Visibility,
  Delete,
  Download,
  PlayArrow,
  Schedule,
  AudioFile,
  Description,
  Event
} from '@mui/icons-material';
import { apiService } from '../services/api';

const PipelineHistory = () => {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [stats, setStats] = useState({});

  const fetchPipelines = async () => {
    try {
      setLoading(true);
      const params = {
        page: page.toString(),
        limit: '10',
        sortBy,
        sortOrder
      };
      
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      
      const response = await apiService.getPipelines(params);
      setPipelines(response.data.pipelines);
      setPagination(response.data.pagination);
    } catch (err) {
      setError('Failed to fetch pipelines: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiService.getPipelineStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchPipelines();
    fetchStats();
  }, [page, searchTerm, statusFilter, sortBy, sortOrder]);

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleStatusFilter = (event, newValue) => {
    setStatusFilter(newValue || '');
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleViewPipeline = async (pipelineId) => {
    try {
      const response = await apiService.getPipeline(pipelineId);
      setSelectedPipeline(response.data);
      setViewModalOpen(true);
    } catch (err) {
      setError('Failed to fetch pipeline details: ' + err.message);
    }
  };

  const handleDeletePipeline = async (pipelineId, deleteFiles = false) => {
    if (!window.confirm('Are you sure you want to delete this pipeline?')) {
      return;
    }
    
    try {
      await apiService.deletePipeline(pipelineId, deleteFiles);
      fetchPipelines(); // Refresh the list
      fetchStats(); // Refresh stats
    } catch (err) {
      setError('Failed to delete pipeline: ' + err.message);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && pipelines.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography level="h2" sx={{ mb: 2 }}>Pipeline History</Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography level="h2" sx={{ mb: 3 }}>Pipeline History</Typography>
      
      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Overview */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography level="body-sm" color="neutral">Total Pipelines</Typography>
                <Typography level="h3">{stats.totalPipelines || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography level="body-sm" color="neutral">Total Views</Typography>
                <Typography level="h3">{stats.totalViews || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography level="body-sm" color="neutral">Avg Duration</Typography>
                <Typography level="h3">{stats.avgDuration ? formatDuration(stats.avgDuration) : '0:00'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography level="body-sm" color="neutral">Total Audio Time</Typography>
                <Typography level="h3">{stats.totalAudioDuration ? formatDuration(stats.totalAudioDuration) : '0:00'}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Input
              placeholder="Search pipelines..."
              startDecorator={<Search />}
              value={searchTerm}
              onChange={handleSearch}
              sx={{ minWidth: 250 }}
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={handleStatusFilter}
              startDecorator={<FilterList />}
              sx={{ minWidth: 150 }}
            >
              <Option value="">All Status</Option>
              <Option value="completed">Completed</Option>
              <Option value="processing">Processing</Option>
              <Option value="failed">Failed</Option>
            </Select>
            <Button
              variant="outlined"
              onClick={() => handleSort('createdAt')}
              endDecorator={sortBy === 'createdAt' ? (sortOrder === 'desc' ? '↓' : '↑') : null}
            >
              Date
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleSort('viewCount')}
              endDecorator={sortBy === 'viewCount' ? (sortOrder === 'desc' ? '↓' : '↑') : null}
            >
              Views
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Pipelines List */}
      {pipelines.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography level="h4" color="neutral">No pipelines found</Typography>
            <Typography color="neutral">
              {searchTerm || statusFilter ? 'Try adjusting your search or filters' : 'Generate your first pipeline to see it here'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {pipelines.map((pipeline) => (
            <Card key={pipeline._id} variant="outlined">
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid xs={12} md={6}>
                    <Stack spacing={1}>
                      <Typography level="title-md">{pipeline.topic}</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip size="sm" color="primary">{pipeline.style}</Chip>
                        <Chip size="sm" color="neutral">{pipeline.audience}</Chip>
                        <Chip size="sm" color="success">{pipeline.tone}</Chip>
                        <Badge badgeContent={pipeline.viewCount} color="neutral" size="sm">
                          <Chip size="sm" startDecorator={<Visibility />}>Views</Chip>
                        </Badge>
                      </Stack>
                    </Stack>
                  </Grid>
                  
                  <Grid xs={12} md={3}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Description fontSize="small" />
                        <Typography level="body-sm">{pipeline.script?.wordCount || 0} words</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AudioFile fontSize="small" />
                        <Typography level="body-sm">
                          {pipeline.audio?.estimatedDuration ? formatDuration(pipeline.audio.estimatedDuration) : 'N/A'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Event fontSize="small" />
                        <Typography level="body-sm">{formatDate(pipeline.createdAt)}</Typography>
                      </Stack>
                    </Stack>
                  </Grid>
                  
                  <Grid xs={12} md={3}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="View Details">
                        <IconButton
                          size="sm"
                          variant="outlined"
                          onClick={() => handleViewPipeline(pipeline._id)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Pipeline">
                        <IconButton
                          size="sm"
                          variant="outlined"
                          color="danger"
                          onClick={() => handleDeletePipeline(pipeline._id)}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Typography level="body-sm">
            Page {page} of {pagination.pages} ({pagination.total} total)
          </Typography>
          <Button
            variant="outlined"
            disabled={page === pagination.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </Stack>
      )}

      {/* View Pipeline Modal */}
      <Modal open={viewModalOpen} onClose={() => setViewModalOpen(false)}>
        <ModalDialog size="lg" sx={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
          <ModalClose />
          {selectedPipeline && (
            <Box>
              <Typography level="h3" sx={{ mb: 2 }}>{selectedPipeline.topic}</Typography>
              
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography level="title-md" sx={{ mb: 2 }}>Generation Parameters</Typography>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">Duration:</Typography>
                          <Typography level="body-sm">{selectedPipeline.duration} minutes</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">Style:</Typography>
                          <Typography level="body-sm">{selectedPipeline.style}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">Audience:</Typography>
                          <Typography level="body-sm">{selectedPipeline.audience}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">Tone:</Typography>
                          <Typography level="body-sm">{selectedPipeline.tone}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">Voice:</Typography>
                          <Typography level="body-sm">{selectedPipeline.voice}</Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography level="title-md" sx={{ mb: 2 }}>Output Details</Typography>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">Word Count:</Typography>
                          <Typography level="body-sm">{selectedPipeline.script?.wordCount || 0}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">Audio Duration:</Typography>
                          <Typography level="body-sm">
                            {selectedPipeline.audio?.estimatedDuration ? formatDuration(selectedPipeline.audio.estimatedDuration) : 'N/A'}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">File Size:</Typography>
                          <Typography level="body-sm">
                            {selectedPipeline.audio?.fileSize ? formatFileSize(selectedPipeline.audio.fileSize) : 'N/A'}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">View Count:</Typography>
                          <Typography level="body-sm">{selectedPipeline.viewCount}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography level="body-sm">Created:</Typography>
                          <Typography level="body-sm">{formatDate(selectedPipeline.createdAt)}</Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                {selectedPipeline.script?.content && (
                  <Grid xs={12}>
                    <Card>
                      <CardContent>
                        <Typography level="title-md" sx={{ mb: 2 }}>Generated Script</Typography>
                        <Box
                          sx={{
                            maxHeight: 300,
                            overflow: 'auto',
                            p: 2,
                            bgcolor: 'background.surface',
                            borderRadius: 'sm'
                          }}
                        >
                          <Typography level="body-sm" sx={{ whiteSpace: 'pre-wrap' }}>
                            {selectedPipeline.script.content}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
              
              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  color="danger"
                  startDecorator={<Delete />}
                  onClick={() => {
                    setViewModalOpen(false);
                    handleDeletePipeline(selectedPipeline._id);
                  }}
                >
                  Delete Pipeline
                </Button>
              </Stack>
            </Box>
          )}
        </ModalDialog>
      </Modal>
    </Box>
  );
};

export default PipelineHistory;
