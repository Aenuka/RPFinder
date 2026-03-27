const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    itNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: /^IT\d{8}$/,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    gpa: {
      type: Number,
      min: 0,
      max: 4,
    },
    githubUsername: {
      type: String,
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
      required: true,
      enum: [
        'Information Technology (General)',
        'Artificial Intelligence (AI)',
        'Software Engineering (SE)',
        'Data Science (DS)',
        'Cyber Security',
        'Computer Systems & Network Engineering',
        'Information Systems Engineering',
        'Interactive Media',
      ],
      default: 'Information Technology (General)',
    },
    techStacks: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one tech stack is required.',
      },
    },
    internshipStatus: {
      type: String,
      enum: ['doing intern', 'finished', 'not yet'],
    },
    linkedin: {
      type: String,
      trim: true,
    },
    itNumberShared: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const detailRequestSchema = new mongoose.Schema(
  {
    memberItNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: /^IT\d{8}$/,
    },
    fieldName: {
      type: String,
      required: true,
      enum: ['itNumberShared', 'gpa', 'githubUsername', 'linkedin', 'internshipStatus'],
    },
    requestedFields: {
      type: [String],
      default: [],
      validate: {
        validator: (value) =>
          Array.isArray(value) &&
          value.every((field) => ['itNumberShared', 'gpa', 'githubUsername', 'linkedin', 'internshipStatus'].includes(field)),
        message: 'requestedFields contains unsupported field names.',
      },
    },
    requesterName: {
      type: String,
      trim: true,
      default: 'Anonymous',
    },
    requesterItNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: /^IT\d{8}$/,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    messages: [
      {
        senderItNumber: {
          type: String,
          trim: true,
          uppercase: true,
        },
        senderName: {
          type: String,
          trim: true,
          default: 'Anonymous',
        },
        content: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const groupSchema = new mongoose.Schema(
  {
    members: {
      type: [memberSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 1 && value.length <= 4,
        message: 'Group must contain between 1 and 4 members.',
      },
    },
    expectedFromNewcomer: {
      type: String,
      trim: true,
    },
    aboutCurrentMembers: {
      type: String,
      trim: true,
    },
    reasonLeftPreviousGroup: {
      type: String,
      trim: true,
    },
    groupStatus: {
      type: String,
      trim: true,
    },
    detailRequests: {
      type: [detailRequestSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

groupSchema.pre('validate', function enforceGroupRules() {
  const memberCount = Array.isArray(this.members) ? this.members.length : 0;

  if (memberCount === 4) {
    this.groupStatus = 'solid group - we stay as group forever';
    this.expectedFromNewcomer = undefined;
    this.reasonLeftPreviousGroup = undefined;
    this.aboutCurrentMembers = undefined;
  }

  if (memberCount === 3 || memberCount === 2) {
    if (!this.expectedFromNewcomer || !this.aboutCurrentMembers) {
      const error = new Error(
        'For groups with 2 or 3 members, expectedFromNewcomer and aboutCurrentMembers are required.'
      );
      error.statusCode = 400;
      throw error;
    }
    this.groupStatus = `${memberCount} member group looking for newcomers`;
    this.reasonLeftPreviousGroup = undefined;
  }

  if (memberCount === 1) {
    if (!this.expectedFromNewcomer || !this.reasonLeftPreviousGroup) {
      const error = new Error(
        'For a 1-member group, expectedFromNewcomer and reasonLeftPreviousGroup are required.'
      );
      error.statusCode = 400;
      throw error;
    }
    this.groupStatus = 'single member looking for 2 or 3 members';
    this.aboutCurrentMembers = undefined;
  }
});

module.exports = mongoose.model('Group', groupSchema);
