const mongoose = require('mongoose');
const validator = require('validator');

const scriptSchema = new mongoose.Schema({
  // Basic Information
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    maxlength: [200, 'Topic cannot exceed 200 characters']
  },
  
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [500, 'Title cannot exceed 500 characters']
  },

  // Script Content
  fullScript: {
    type: String,
    required: [true, 'Script content is required'],
    minlength: [50, 'Script must be at least 50 characters']
  },

  // Structured Sections
  sections: {
    hook: {
      type: String,
      default: ''
    },
    introduction: {
      type: String,
      default: ''
    },
    mainContent: {
      type: String,
      default: ''
    },
    conclusion: {
      type: String,
      default: ''
    },
    visualCues: {
      type: String,
      default: ''
    }
  },

  // Generation Options
  options: {
    duration: {
      type: Number,
      required: true,
      min: [0.5, 'Duration must be at least 0.5 minutes'],
      max: [120, 'Duration cannot exceed 120 minutes']
    },
    style: {
      type: String,
      required: true,
      enum: ['engaging', 'educational', 'entertaining', 'professional'],
      default: 'engaging'
    },
    audience: {
      type: String,
      required: true,
      enum: ['general', 'technical', 'kids', 'adults', 'professionals'],
      default: 'general'
    },
    tone: {
      type: String,
      required: true,
      enum: ['conversational', 'formal', 'casual', 'enthusiastic'],
      default: 'conversational'
    }
  },

  // Analytics
  wordCount: {
    type: Number,
    required: true,
    min: [1, 'Word count must be positive']
  },

  estimatedDuration: {
    type: Number,
    required: true,
    min: [0.1, 'Estimated duration must be positive']
  },

  // File Information
  filename: {
    type: String,
    required: true,
    unique: true
  },

  // Status and Processing
  status: {
    type: String,
    enum: ['draft', 'generated', 'processed', 'archived'],
    default: 'generated'
  },

  // AI Generation Metadata
  aiModel: {
    type: String,
    default: 'claude-3-5-sonnet-20241022'
  },

  generationTime: {
    type: Number, // milliseconds
    min: 0
  },

  // Usage Tracking
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },

  lastViewed: {
    type: Date
  },

  // Tags for categorization
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Future microservices integration
  voiceGenerated: {
    type: Boolean,
    default: false
  },

  imagesGenerated: {
    type: Boolean,
    default: false
  },

  videoGenerated: {
    type: Boolean,
    default: false
  },

  // Related files (for future use)
  relatedFiles: {
    audioFile: String,
    videoFile: String,
    thumbnailFile: String,
    imagesFolder: String
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
scriptSchema.index({ topic: 'text', title: 'text' }); // Text search
scriptSchema.index({ createdAt: -1 }); // Sort by creation date
scriptSchema.index({ 'options.style': 1, 'options.audience': 1 }); // Filter by options
scriptSchema.index({ status: 1 }); // Filter by status
scriptSchema.index({ tags: 1 }); // Filter by tags

// Virtual for formatted creation date
scriptSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString() + ' ' + this.createdAt.toLocaleTimeString();
});

// Virtual for reading time estimate (words per minute)
scriptSchema.virtual('readingTimeMinutes').get(function() {
  const wordsPerMinute = 200; // Average reading speed
  return Math.ceil(this.wordCount / wordsPerMinute);
});

// Pre-save middleware to generate filename if not provided
scriptSchema.pre('save', function(next) {
  if (!this.filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.filename = `${this.topic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${timestamp}.txt`;
  }
  
  // Auto-generate tags from topic
  if (!this.tags || this.tags.length === 0) {
    const topicWords = this.topic.toLowerCase().split(/\s+/);
    this.tags = topicWords.filter(word => word.length > 2);
  }
  
  next();
});

// Instance methods
scriptSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  this.lastViewed = new Date();
  return this.save();
};

scriptSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  return this.save();
};

scriptSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag.toLowerCase())) {
    this.tags.push(tag.toLowerCase());
    return this.save();
  }
  return Promise.resolve(this);
};

// Static methods
scriptSchema.statics.findByTopic = function(topic) {
  return this.find({ 
    $text: { $search: topic } 
  }).sort({ score: { $meta: 'textScore' } });
};

scriptSchema.statics.findRecent = function(limit = 10) {
  return this.find({ status: { $ne: 'archived' } })
    .sort({ createdAt: -1 })
    .limit(limit);
};

scriptSchema.statics.findByOptions = function(options) {
  const query = {};
  if (options.style) query['options.style'] = options.style;
  if (options.audience) query['options.audience'] = options.audience;
  if (options.tone) query['options.tone'] = options.tone;
  if (options.duration) {
    query['options.duration'] = { 
      $gte: options.duration - 1, 
      $lte: options.duration + 1 
    };
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

scriptSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalScripts: { $sum: 1 },
        totalWords: { $sum: '$wordCount' },
        avgDuration: { $avg: '$estimatedDuration' },
        avgWords: { $avg: '$wordCount' },
        styles: { $push: '$options.style' },
        audiences: { $push: '$options.audience' }
      }
    }
  ]);
  
  return stats[0] || {
    totalScripts: 0,
    totalWords: 0,
    avgDuration: 0,
    avgWords: 0,
    styles: [],
    audiences: []
  };
};

const Script = mongoose.model('Script', scriptSchema);

module.exports = Script;
