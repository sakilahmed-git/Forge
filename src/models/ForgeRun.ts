import mongoose, { Schema } from 'mongoose';

const ForgeRunSchema = new Schema({
  runId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userPrompt: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'architecting', 'building', 'integrating', 'complete', 'failed'],
    default: 'pending',
  },
  deploymentTarget: {
    type: String,
    enum: ['personal', 'startup', 'enterprise'],
  },
  agentStatuses: {
    type: Map,
    of: String,
    default: {},
  },
  blueprintId: {
    type: String,
  },
  finalOutputPath: {
    type: String,
  },
  error: {
    type: String,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
});

export const ForgeRun = mongoose.model('ForgeRun', ForgeRunSchema);
