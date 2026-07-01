import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { setStreamEmitter } from '../services/openai.service';
import { v4 as uuid } from 'uuid';
import { runArchitect } from '../agents/architect.agent';
import { runIntegrator } from '../agents/integrator.agent';
import { AgentOutputModel } from '../models/AgentOutputModel';
import { ForgeRun } from '../models/ForgeRun';
import { Blueprint } from '../types/blueprint';
import { assertValidBlueprint } from './blueprint-validator';
import { executeBuilders } from './executor';

export interface OrchestratorOptions {
  userPrompt: string;
  deploymentTarget?: 'personal' | 'startup' | 'enterprise';
  outputDir?: string;
  runId?: string;
}

export interface OrchestratorResult {
  runId: string;
  success: boolean;
  blueprint?: Blueprint;
  outputDir?: string;
  stats: {
    totalTime: number;
    architectTime: number;
    buildTime: number;
    integrateTime: number;
    escalations: string[];
  };
  error?: string;
  partialOutputs?: Record<string, string>;
}

function writeOutputFiles(outputDir: string, files: Record<string, string>): void {
  for (const [filePath, content] of Object.entries(files)) {
    const targetPath = path.join(outputDir, filePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runForge(
  options: OrchestratorOptions,
  emitter: EventEmitter
): Promise<OrchestratorResult> {
  const runId = options.runId || uuid();
  setStreamEmitter(emitter, runId);
  console.log('✓ Stream emitter set:', runId.slice(0,8));
  const startedAt = Date.now();
  const deploymentTarget = options.deploymentTarget || 'personal';
  const stats = {
    totalTime: 0,
    architectTime: 0,
    buildTime: 0,
    integrateTime: 0,
    escalations: [] as string[],
  };
  let blueprint: Blueprint | undefined;
  let partialOutputs: Record<string, string> | undefined;

  try {
    await ForgeRun.create({
      runId,
      userPrompt: options.userPrompt,
      status: 'pending',
      deploymentTarget,
      agentStatuses: {},
      startedAt: new Date(),
    });

    emitter.emit('forge:started', { runId, prompt: options.userPrompt });

    await ForgeRun.updateOne({ runId }, { status: 'architecting' });
    emitter.emit('phase:started', { runId, phase: 'architect' });
    const architectStartedAt = Date.now();
    blueprint = await runArchitect(options.userPrompt, deploymentTarget);
    assertValidBlueprint(blueprint);
    stats.architectTime = Date.now() - architectStartedAt;
    await ForgeRun.updateOne({ runId }, { status: 'building', blueprintId: blueprint.id });
    emitter.emit('phase:completed', { runId, phase: 'architect', blueprint });

    emitter.emit('phase:started', { runId, phase: 'building' });
    const buildStartedAt = Date.now();
    const executorResult = await executeBuilders(blueprint, runId, emitter);
    stats.buildTime = Date.now() - buildStartedAt;
    stats.escalations = executorResult.escalations;
    emitter.emit('phase:completed', { runId, phase: 'building', result: executorResult });

    await ForgeRun.updateOne({ runId }, { status: 'integrating' });
    emitter.emit('phase:started', { runId, phase: 'integrating' });
    const integrateStartedAt = Date.now();
    const integratorOutput = await runIntegrator({ blueprint, outputs: executorResult.outputs });
    stats.integrateTime = Date.now() - integrateStartedAt;
    partialOutputs = integratorOutput.files;
    emitter.emit('phase:completed', { runId, phase: 'integrating', output: integratorOutput });

    const finalOutputDir = options.outputDir || path.join(process.cwd(), 'forge-output', runId);
    writeOutputFiles(finalOutputDir, integratorOutput.files);

    stats.totalTime = Date.now() - startedAt;
    await ForgeRun.updateOne(
      { runId },
      {
        status: 'complete',
        finalOutputPath: finalOutputDir,
        completedAt: new Date(),
      }
    );
    emitter.emit('forge:completed', { runId, outputDir: finalOutputDir, stats });

    return {
      runId,
      success: true,
      blueprint,
      outputDir: finalOutputDir,
      stats,
    };
  } catch (error) {
    const message = errorMessage(error);
    stats.totalTime = Date.now() - startedAt;

    await ForgeRun.updateOne(
      { runId },
      {
        status: 'failed',
        error: message,
        completedAt: new Date(),
      }
    );

    const savedOutputs = await AgentOutputModel.find({ runId });
    partialOutputs =
      partialOutputs ||
      savedOutputs.reduce<Record<string, string>>((accumulator, outputDocument) => {
        const output = outputDocument.output as unknown as Map<string, string> | Record<string, string>;
        const entries = output instanceof Map ? Array.from(output.entries()) : Object.entries(output);

        entries.forEach(([filePath, content]) => {
          accumulator[filePath] = content;
        });

        return accumulator;
      }, {});

    emitter.emit('forge:failed', { runId, error: message, partialOutputs });

    return {
      runId,
      success: false,
      blueprint,
      stats,
      error: message,
      partialOutputs,
    };
  }
}
