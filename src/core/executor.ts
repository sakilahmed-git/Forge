import { EventEmitter } from 'events';
import { runBuilder, BuilderOutput } from '../agents/builder.agent';
import { criticLoop } from '../agents/critic.agent';
import { AgentOutputModel } from '../models/AgentOutputModel';
import { Blueprint, Module } from '../types/blueprint';

export interface ExecutorResult {
  outputs: BuilderOutput[];
  waveTimings: Record<number, number>;
  totalTime: number;
  escalations: string[];
}

function findModule(blueprint: Blueprint, moduleId: string): Module {
  const module = blueprint.modules.find((candidate) => candidate.id === moduleId);

  if (!module) {
    throw new Error(`Module ${moduleId} not found in blueprint`);
  }

  return module;
}

export async function executeBuilders(
  blueprint: Blueprint,
  runId: string,
  emitter: EventEmitter
): Promise<ExecutorResult> {
  const startedAt = Date.now();
  const outputs: BuilderOutput[] = [];
  const waveTimings: Record<number, number> = {};
  const escalations: string[] = [];

  for (let waveIndex = 0; waveIndex < blueprint.executionOrder.length; waveIndex += 1) {
    const waveStartedAt = Date.now();
    const wave = blueprint.executionOrder[waveIndex];
    const modules = wave.map((moduleId) => findModule(blueprint, moduleId));

    const waveOutputs = await Promise.all(
      modules.map(async (module) => {
        emitter.emit('agent:started', { runId, moduleId: module.id, wave: waveIndex });

        const builderOutput = await runBuilder({ blueprint, module, attempt: 1 });
        const criticResult = await criticLoop(builderOutput, blueprint, module);

        emitter.emit('agent:completed', {
          runId,
          moduleId: module.id,
          verdict: criticResult.verdict,
          iterations: criticResult.iterations,
        });

        if (criticResult.escalated) {
          escalations.push(module.id);
          emitter.emit('agent:escalated', { runId, moduleId: module.id });
        }

        await AgentOutputModel.create({
          runId,
          moduleId: module.id,
          agentId: module.ownerAgent,
          output: { ... (criticResult.output.files || {}) },
          iterations: criticResult.iterations,
          escalated: criticResult.escalated,
          criticScores: criticResult.verdict.scores,
          approvedAt: new Date(),
        });

        return criticResult.output;
      })
    );

    outputs.push(...waveOutputs);
    waveTimings[waveIndex] = Date.now() - waveStartedAt;
    emitter.emit('wave:completed', { runId, wave: waveIndex, modules: wave });
  }

  return {
    outputs,
    waveTimings,
    totalTime: Date.now() - startedAt,
    escalations,
  };
}
