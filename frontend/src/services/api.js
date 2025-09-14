import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_HOST || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Polling function for job status when connection is lost
const pollJobStatus = (jobId, onProgress, resolve, reject, clearJobId) => {
  console.log('🔄 Starting polling for job:', jobId);
  
  const pollInterval = setInterval(async () => {
    try {
      console.log('📊 Polling job status for:', jobId);
      const jobData = await apiService.checkJobStatus(jobId);
      console.log('📥 Poll response:', jobData);
      
      if (jobData.success) {
        const job = jobData.data;
        
        // Send progress update with more detailed information
        if (onProgress) {
          let progressMessage = `Job ${job.status} (${job.progress}%)`;
          
          // Provide more detailed messages based on status
          if (job.status === 'chunk_start' && job.chunkIndex !== undefined) {
            progressMessage = `Processing audio chunk ${job.chunkIndex + 1} of ${job.totalChunks || 'unknown'}`;
          } else if (job.status === 'chunk_complete' && job.chunkIndex !== undefined) {
            progressMessage = `Completed audio chunk ${job.chunkIndex + 1} of ${job.totalChunks || 'unknown'} (${job.progress}%)`;
          } else if (job.status === 'combining') {
            progressMessage = `Combining ${job.totalChunks || 'audio'} segments into final file...`;
          } else if (job.status === 'chunks_created') {
            progressMessage = `Split into ${job.totalChunks} segments`;
          }
          
          onProgress({
            type: job.status || 'polling_update',
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            message: progressMessage,
            chunkIndex: job.chunkIndex,
            totalChunks: job.totalChunks
          });
        }
        
        if (job.isComplete) {
          console.log('✅ Polling completed - job finished:', job);
          clearInterval(pollInterval);
          clearJobId();
          
          if (job.result) {
            console.log('🎉 Resolving with job result:', job.result);
            resolve(job.result);
          } else {
            console.error('❌ Job completed but no result:', job.error);
            reject(new Error(job.error || 'Job failed'));
          }
        }
      } else {
        // Job not found, stop polling
        console.warn('⚠️ Job not found during polling, stopping');
        clearInterval(pollInterval);
        clearJobId();
        reject(new Error('Job no longer exists'));
      }
    } catch (error) {
      console.warn('⚠️ Polling error:', error.message);
      // Continue polling on error
    }
  }, 2000); // Poll every 2 seconds
  
  // Stop polling after 30 minutes
  setTimeout(() => {
    console.warn('⏰ Polling timeout after 30 minutes for job:', jobId);
    clearInterval(pollInterval);
    clearJobId();
    reject(new Error('Job polling timeout'));
  }, 30 * 60 * 1000);
};

const apiService = {
  // Health check
  async getHealth() {
    const response = await api.get('/health');
    return response.data;
  },

  // Script generation
  async generateScript(data) {
    const response = await api.post('/api/generate-script', data);
    return response.data;
  },

  // Audio generation
  async generateAudio(data) {
    const response = await api.post('/api/generate-audio', data);
    return response.data;
  },

  generateAudioWithProgress: async (data, onProgress) => {
    console.log('🎵 Starting audio generation with data:', data);
    
    return new Promise((resolve, reject) => {
      let currentJobId = null;

      // Store job ID in localStorage for recovery
      const storeJobId = (jobId) => {
        currentJobId = jobId;
        localStorage.setItem('currentAudioJob', jobId);
        console.log('💾 Stored job ID:', jobId);
      };

      const clearJobId = () => {
        localStorage.removeItem('currentAudioJob');
        console.log('🗑️ Cleared job ID from localStorage');
      };

      // Skip existing job check here - handled by component useEffect

      console.log('📡 Making fetch request to:', `${API_BASE_URL}/api/generate-audio`);
      
      fetch(`${API_BASE_URL}/api/generate-audio`, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(data)
      })
      .then(response => {
        console.log('📥 Received response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        function readStream() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              console.log('📡 Stream ended - checking if we have a job to poll');
              // If stream ends but we have a job ID, start polling
              if (currentJobId) {
                console.log('🔄 Stream ended, switching to polling for job:', currentJobId);
                pollJobStatus(currentJobId, onProgress, resolve, reject, clearJobId);
              }
              return;
            }

            const chunk = decoder.decode(value, { stream: true });
            console.log('📦 Received chunk:', chunk);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.trim() && line.startsWith('data: ')) {
                try {
                  const progressData = JSON.parse(line.slice(6));
                  console.log('📊 Progress data received:', progressData);
                  
                  // Store job ID when received
                  if (progressData.jobId && !currentJobId) {
                    console.log('💾 Storing job ID from progress:', progressData.jobId);
                    storeJobId(progressData.jobId);
                  }
                  
                  if (progressData.type === 'complete') {
                    console.log('✅ Audio generation completed:', progressData.data);
                    clearJobId();
                    resolve(progressData.data);
                    return;
                  } else if (progressData.type === 'error') {
                    console.error('❌ Audio generation error:', progressData.error);
                    clearJobId();
                    reject(new Error(progressData.error));
                    return;
                  } else if (onProgress) {
                    console.log('📤 Calling onProgress with:', progressData.type);
                    onProgress(progressData);
                  }
                } catch (e) {
                  console.warn('⚠️ Failed to parse SSE data:', line, 'Error:', e);
                }
              }
            }

            return readStream();
          }).catch(streamError => {
            console.error('📡 Stream reading error:', streamError);
            // If we have a job ID, try polling
            if (currentJobId) {
              console.log('🔄 Stream error, switching to polling for job:', currentJobId);
              pollJobStatus(currentJobId, onProgress, resolve, reject, clearJobId);
            } else {
              reject(streamError);
            }
          });
        }

        return readStream();
      })
      .catch(error => {
        console.error('🚨 Fetch error:', error);
        
        // If connection fails and we have a job ID, start polling
        if (currentJobId) {
          console.log('🔄 Connection lost, switching to polling mode for job:', currentJobId);
          pollJobStatus(currentJobId, onProgress, resolve, reject, clearJobId);
        } else {
          console.error('❌ No job ID available for polling, rejecting with error:', error);
          reject(error);
        }
      });
    });
  },

  // Job status checking for reconnection
  async checkJobStatus(jobId) {
    const response = await api.get(`/api/job-status/${jobId}`);
    return response.data;
  },

  // Complete pipeline (script + audio)
  async generateScriptToAudio(data) {
    const response = await api.post('/api/script-to-audio', data);
    return response.data;
  },

  // Complete pipeline with progress tracking and job recovery
  generateScriptToAudioWithProgress: async (data, onProgress) => {
    console.log('🎬 Starting script-to-audio pipeline with data:', data);
    
    return new Promise((resolve, reject) => {
      let currentJobId = null;

      // Store job ID in localStorage for recovery
      const storeJobId = (jobId) => {
        currentJobId = jobId;
        localStorage.setItem('currentPipelineJob', jobId);
        console.log('💾 Stored pipeline job ID:', jobId);
      };

      const clearJobId = () => {
        localStorage.removeItem('currentPipelineJob');
        console.log('🗑️ Cleared pipeline job ID from localStorage');
      };

      console.log('📡 Making fetch request to:', `${API_BASE_URL}/api/script-to-audio`);
      
      fetch(`${API_BASE_URL}/api/script-to-audio`, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      .then(response => {
        console.log('📥 Received pipeline response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        function readStream() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              console.log('📡 Pipeline stream ended');
              return;
            }

            const chunk = decoder.decode(value);
            console.log('📦 Received pipeline chunk:', chunk);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const progressData = JSON.parse(line.slice(6));
                  console.log('📊 Pipeline progress data:', progressData);
                  
                  // Store job ID when received
                  if (progressData.jobId && !currentJobId) {
                    storeJobId(progressData.jobId);
                  }
                  
                  if (progressData.type === 'complete') {
                    console.log('✅ Pipeline generation completed:', progressData.data);
                    clearJobId();
                    resolve(progressData.data);
                    return;
                  } else if (progressData.type === 'error') {
                    console.error('❌ Pipeline generation error:', progressData.error);
                    clearJobId();
                    reject(new Error(progressData.error));
                    return;
                  } else if (onProgress) {
                    onProgress(progressData);
                  }
                } catch (e) {
                  console.warn('⚠️ Failed to parse pipeline SSE data:', line, 'Error:', e);
                }
              }
            }

            return readStream();
          });
        }

        return readStream();
      })
      .catch(error => {
        console.error('🚨 Pipeline fetch error:', error);
        
        // If connection fails and we have a job ID, start polling
        if (currentJobId) {
          console.log('🔄 Pipeline connection lost, switching to polling mode for job:', currentJobId);
          pollJobStatus(currentJobId, onProgress, resolve, reject, clearJobId);
        } else {
          console.error('❌ No pipeline job ID available for polling, rejecting with error:', error);
          reject(error);
        }
      });
    });
  },

  // Check for existing pipeline job
  async checkExistingPipelineJob() {
    const existingJobId = localStorage.getItem('currentPipelineJob');
    console.log('🔍 Checking for existing pipeline job:', existingJobId);
    
    if (existingJobId) {
      try {
        console.log('📊 Checking pipeline job status for:', existingJobId);
        const jobData = await this.checkJobStatus(existingJobId);
        console.log('📥 Pipeline job status response:', jobData);
        
        return {
          exists: true,
          jobId: existingJobId,
          jobData: jobData.success ? jobData.data : null
        };
      } catch (error) {
        console.log('❌ Pipeline job check failed:', error);
        localStorage.removeItem('currentPipelineJob');
        return { exists: false };
      }
    }
    
    return { exists: false };
  },

  // File management
  async getFiles() {
    const response = await api.get('/api/files');
    return response.data;
  },

  downloadFile: async (type, filename) => {
    try {
      const response = await api.get(`/api/download/${type}/${filename}`, {
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      // If blob request fails, try as text for scripts
      if (type === 'scripts') {
        const response = await api.get(`/api/download/${type}/${filename}`, {
          responseType: 'text'
        });
        return response;
      }
      throw error;
    }
  },

  async deleteFile(type, filename) {
    const response = await api.delete(`/api/delete/${type}/${filename}`);
    return response.data;
  },

  // System info
  async getVoices() {
    const response = await api.get('/api/voices');
    return response.data;
  },

  async getStats() {
    const response = await api.get('/api/stats');
    return response.data;
  },

  // Pipeline management
  async getPipelines(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/api/pipelines${queryString ? '?' + queryString : ''}`);
    return response.data;
  },

  async getPipeline(id) {
    const response = await api.get(`/api/pipelines/${id}`);
    return response.data;
  },

  async deletePipeline(id, deleteFiles = false) {
    const params = deleteFiles ? '?deleteFiles=true' : '';
    const response = await api.delete(`/api/pipelines/${id}${params}`);
    return response.data;
  },

  async getPipelineStats() {
    const response = await api.get('/api/pipelines/stats/overview');
    return response.data;
  },
};

export default apiService;
export { apiService };
