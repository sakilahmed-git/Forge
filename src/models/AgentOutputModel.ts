import mongoose, { Schema } from 'mongoose';

const AgentOutputSchema = new Schema({
  runId: {
    type: String,
    required: true,
    index: true,
  },
  moduleId: {
    type: String,
    required: true,
  },
  agentId: {
    type: String,
    required: true,
  },
  output: {
    type: Schema.Types.Mixed,
    default: {},
  },
  iterations: {
    type: Number,
    default: 1,
  },
  escalated: {
    type: Boolean,
    default: false,
  },
  criticScores: {
    type: Schema.Types.Mixed,
  },
  approvedAt: {
    type: Date,
    default: Date.now,
  },
});

export const AgentOutputModel = mongoose.model('AgentOutput', AgentOutputSchema);
