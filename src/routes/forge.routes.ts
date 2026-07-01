import { Request, Response, Router } from 'express';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { runForge } from '../core/orchestrator';
import { createForgeEmitter, attachSocketBridge } from '../dashboard/events';
import { AgentOutputModel } from '../models/AgentOutputModel';
import { ForgeRun } from '../models/ForgeRun';

const router = Router();

const RunSchema = z.object({
  prompt: z.string().min(20, 'Prompt must be at least 20 characters').max(500),
  deploymentTarget: z.enum(['personal', 'startup', 'enterprise']).default('startup'),
});

router.post('/run', (req: Request, res: Response) => {
  const result = RunSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }

  const { prompt, deploymentTarget } = result.data;
  const runId = uuid();
  const emitter = createForgeEmitter();
  const io = req.app.locals.io as Server;

  attachSocketBridge(io, emitter, runId);

  void runForge({ userPrompt: prompt, deploymentTarget, runId }, emitter).catch((err: unknown) => {
    console.error('Forge run error:', err);
  });

  return res.status(202).json({
    runId,
    message: 'FORGE started — building your project',
    status: 'pending',
    dashboardUrl: `http://localhost:3000/run/${runId}`,
  });
});

router.get('/:runId/status', async (req: Request, res: Response) => {
  try {
    const run = await ForgeRun.findOne({ runId: req.params.runId });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    return res.json(run);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch run status' });
  }
});

router.get('/:runId/output', async (req: Request, res: Response) => {
  try {
    const run = await ForgeRun.findOne({ runId: req.params.runId });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.status !== 'complete') {
      return res.status(400).json({ message: `Run is ${run.status} — not complete yet` });
    }

    const outputs = await AgentOutputModel.find({ runId: req.params.runId });

    return res.json({ run, outputs });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch output' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const runs = await ForgeRun.find({}).sort({ startedAt: -1 }).limit(10);
    return res.json(runs);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

export default router;
