const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // Project Information
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // Project Status
  status: {
    type: String,
    enum: ['planning', 'script_ready', 'voice_generated', 'images_generated', 'video_assembled', 'completed'],
    default: 'planning'
  },

  // Associated Scripts
  scripts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Script'
  }],

  // Project Settings
  settings: {
    targetDuration: {
      type: Number,
      min: 0.5,
      max: 120
    },
    style: {
      type: String,
      enum: ['engaging', 'educational', 'entertaining', 'professional']
    },
    audience: {
      type: String,
      enum: ['general', 'technical', 'kids', 'adults', 'professionals']
    }
  },

  // Progress Tracking
  progress: {
    scriptGenerated: {
      type: Boolean,
      default: false
    },
    voiceGenerated: {
      type: Boolean,
      default: false
    },
    imagesGenerated: {
      type: Boolean,
      default: false
    },
    videoAssembled: {
      type: Boolean,
      default: false
    }
  },

  // Output Files
  outputFiles: {
    finalVideo: String,
    audioTrack: String,
    thumbnail: String,
    assets: [String]
  },

  // Metadata
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Analytics
  totalGenerationTime: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
projectSchema.index({ name: 'text', description: 'text' });
projectSchema.index({ status: 1 });
projectSchema.index({ createdAt: -1 });

// Virtual for completion percentage
projectSchema.virtual('completionPercentage').get(function() {
  const steps = ['scriptGenerated', 'voiceGenerated', 'imagesGenerated', 'videoAssembled'];
  const completed = steps.filter(step => this.progress[step]).length;
  return Math.round((completed / steps.length) * 100);
});

// Methods
projectSchema.methods.updateProgress = function(step, completed = true) {
  if (this.progress.hasOwnProperty(step)) {
    this.progress[step] = completed;
    
    // Auto-update status based on progress
    if (this.progress.scriptGenerated && !this.progress.voiceGenerated) {
      this.status = 'script_ready';
    } else if (this.progress.voiceGenerated && !this.progress.imagesGenerated) {
      this.status = 'voice_generated';
    } else if (this.progress.imagesGenerated && !this.progress.videoAssembled) {
      this.status = 'images_generated';
    } else if (this.progress.videoAssembled) {
      this.status = 'completed';
    }
    
    return this.save();
  }
  return Promise.resolve(this);
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
