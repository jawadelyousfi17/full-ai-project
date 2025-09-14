import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

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
        
        // Send progress update
        if (onProgress) {
          onProgress({
            type: 'polling_update',
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            message: `Reconnected - Job ${job.status} (${job.progress}%)`
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
          'Content-Type': 'application/json'
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
              console.log('📡 Stream ended');
              return;
            }

            const chunk = decoder.decode(value);
            console.log('📦 Received chunk:', chunk);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const progressData = JSON.parse(line.slice(6));
                  console.log('📊 Progress data:', progressData);
                  
                  // Store job ID when received
                  if (progressData.jobId && !currentJobId) {
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
                    onProgress(progressData);
                  }
                } catch (e) {
                  console.warn('⚠️ Failed to parse SSE data:', line, 'Error:', e);
                }
              }
            }

            return readStream();
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
};

export default apiService;
export { apiService };
