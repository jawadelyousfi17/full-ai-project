const mongoose = require('mongoose');

const PipelineSchema = new mongoose.Schema({
  // Basic pipeline information
  topic: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  // Generation parameters
  parameters: {
    duration: {
      type: Number,
      required: true,
      min: 1,
      max: 30
    },
    style: {
      type: String,
      required: true,
      enum: ['educational', 'entertainment', 'documentary', 'tutorial', 'news', 'marketing']
    },
    audience: {
      type: String,
      required: true,
      enum: ['general', 'children', 'teens', 'adults', 'professionals', 'seniors']
    },
    tone: {
      type: String,
      required: true,
      enum: ['friendly', 'professional', 'casual', 'formal', 'enthusiastic', 'calm']
    },
    format: {
      type: String,
      required: true,
      enum: ['mp3', 'wav', 'flac'],
      default: 'mp3'
    },
    voice: {
      type: String,
      required: true,
      default: '090623498e9843068d8507db5a700f90'
    }
  },

  // Generated content
  script: {
    filePath: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    wordCount: {
      type: Number,
      required: true
    },
    estimatedDuration: {
      type: Number,
      required: true
    }
  },

  audio: {
    outputPath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    estimatedDuration: {
      type: Number,
      required: true
    },
    format: {
      type: String,
      required: true
    },
    chunks: {
      type: Number,
      default: 1
    }
  },

  // Generation metadata
  generation: {
    jobId: {
      type: String,
      required: true,
      unique: true
    },
    startTime: {
      type: Date,
      required: true
    },
    completionTime: {
      type: Date,
      required: true
    },
    totalDuration: {
      type: Number, // in milliseconds
      required: true
    },
    scriptGenerationTime: {
      type: Number // in milliseconds
    },
    audioGenerationTime: {
      type: Number // in milliseconds
    }
  },

  // Analytics and usage
  analytics: {
    viewCount: {
      type: Number,
      default: 0
    },
    downloadCount: {
      type: Number,
      default: 0
    },
    lastAccessed: {
      type: Date,
      default: Date.now
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: [{
      comment: String,
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // File management
  files: {
    scriptFilename: String,
    audioFilename: String,
    thumbnailPath: String
  },

  // Status and flags
  status: {
    type: String,
    enum: ['completed', 'archived', 'featured'],
    default: 'completed'
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better query performance
PipelineSchema.index({ topic: 'text', 'script.content': 'text' });
PipelineSchema.index({ createdAt: -1 });
PipelineSchema.index({ 'analytics.viewCount': -1 });
PipelineSchema.index({ 'generation.jobId': 1 });
PipelineSchema.index({ status: 1 });
PipelineSchema.index({ tags: 1 });

// Virtual for total file size
PipelineSchema.virtual('totalFileSize').get(function() {
  return this.audio.fileSize + (this.script.content.length * 2); // Rough estimate for script size
});

// Virtual for files array
PipelineSchema.virtual('allFiles').get(function() {
  return [
    {
      type: 'script',
      path: this.script.filePath,
      filename: this.files.scriptFilename,
      size: this.script.content.length * 2
    },
    {
      type: 'audio',
      path: this.audio.outputPath,
      filename: this.files.audioFilename,
      size: this.audio.fileSize
    }
  ];
});

// Instance methods
PipelineSchema.methods.incrementView = function() {
  this.analytics.viewCount += 1;
  this.analytics.lastAccessed = new Date();
  return this.save();
};

PipelineSchema.methods.incrementDownload = function() {
  this.analytics.downloadCount += 1;
  this.analytics.lastAccessed = new Date();
  return this.save();
};

PipelineSchema.methods.addFeedback = function(comment, rating) {
  this.analytics.feedback.push({ comment, rating });
  // Update average rating
  const totalRatings = this.analytics.feedback.length;
  const sumRatings = this.analytics.feedback.reduce((sum, fb) => sum + fb.rating, 0);
  this.analytics.rating = Math.round((sumRatings / totalRatings) * 10) / 10;
  return this.save();
};

// Static methods
PipelineSchema.statics.findByTopic = function(topic) {
  return this.find({ 
    topic: { $regex: topic, $options: 'i' } 
  }).sort({ createdAt: -1 });
};

PipelineSchema.statics.findPopular = function(limit = 10) {
  return this.find({ status: 'completed' })
    .sort({ 'analytics.viewCount': -1, createdAt: -1 })
    .limit(limit);
};

PipelineSchema.statics.findRecent = function(limit = 10) {
  return this.find({ status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit);
};

PipelineSchema.statics.searchPipelines = function(query, options = {}) {
  const {
    limit = 20,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1,
    status = 'completed'
  } = options;

  const searchCriteria = {
    status,
    $or: [
      { topic: { $regex: query, $options: 'i' } },
      { 'script.content': { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };

  return this.find(searchCriteria)
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);
};

// Pre-save middleware
PipelineSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate tags from topic
  if (this.isModified('topic')) {
    const words = this.topic.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5); // Limit to 5 tags
    this.tags = [...new Set([...this.tags, ...words])];
  }
  
  next();
});

// Export model
const Pipeline = mongoose.model('Pipeline', PipelineSchema);

module.exports = Pipeline;
