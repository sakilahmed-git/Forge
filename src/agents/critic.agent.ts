import { callLLMJSON } from '../services/openai.service';
import { compileTypeScript } from '../services/sandbox.service';
import { Blueprint, Module } from '../types/blueprint';
import { BuilderOutput, runBuilder } from './builder.agent';

export interface CriticVerdict {
  verdict: 'approved' | 'rejected';
  scores: {
    correctness: number;
    completeness: number;
    security: number;
    productionReadiness: number;
    specAlignment: number;
  };
  overallScore: number;
  specificFixes: string[];
  reasoning: string;
}

const CRITIC_SYSTEM_PROMPT = `You are a code critic. Score these dimensions 1-10:
correctness, completeness, security, productionReadiness, specAlignment
Approve if all >= 6. Reject with exact fixes if any < 6.
Respond ONLY with: {"verdict":"approved"|"rejected","scores":{...},"specificFixes":[...]}`;

function calculateOverallScore(scores: CriticVerdict['scores']): number {
  return (
    scores.correctness +
    scores.completeness +
    scores.security +
    scores.productionReadiness +
    scores.specAlignment
  ) / 5;
}

function combinedFiles(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([filePath, content]) => `// FILE: ${filePath}\n${content}`)
    .join('\n\n');
}

export async function runCritic(
  builderOutput: BuilderOutput,
  blueprint: Blueprint,
  module: Module
): Promise<CriticVerdict> {
  const compilation = await compileTypeScript(combinedFiles(builderOutput.files));
  const userMessage = JSON.stringify(
    {
      files: builderOutput.files,
      typeScriptErrors: compilation.errors,
      acceptanceCriteria: module.acceptanceCriteria,
      userPrompt: blueprint.userPrompt,
      deploymentTarget: blueprint.deploymentTarget,
    },
    null,
    2
  );

  const verdict = await callLLMJSON<CriticVerdict>(CRITIC_SYSTEM_PROMPT, userMessage);
  const overallScore = calculateOverallScore(verdict.scores);
  const threshold = blueprint.deploymentTarget === 'personal' ? 5 : 7;
  const allScoresMeetThreshold = Object.values(verdict.scores).every((score) => score >= threshold);
  const approved = compilation.success && overallScore >= threshold && allScoresMeetThreshold;

  return {
    ...verdict,
    overallScore,
    verdict: approved ? 'approved' : 'rejected',
    specificFixes: compilation.success
      ? verdict.specificFixes
      : [
          ...verdict.specificFixes,
          `Fix TypeScript compilation errors: ${compilation.errors}`,
        ],
  };
}

export async function criticLoop(
  initialOutput: BuilderOutput,
  blueprint: Blueprint,
  module: Module,
  maxIterations = 3
): Promise<{
  output: BuilderOutput;
  verdict: CriticVerdict;
  iterations: number;
  escalated: boolean;
}> {
  let output = initialOutput;
  let lastVerdict: CriticVerdict | undefined;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    lastVerdict = await runCritic(output, blueprint, module);
    console.log(
      `Critic iteration ${iteration} for ${module.id}: score ${lastVerdict.overallScore}, verdict ${lastVerdict.verdict}`
    );

    if (lastVerdict.verdict === 'approved') {
      return {
        output,
        verdict: lastVerdict,
        iterations: iteration,
        escalated: false,
      };
    }

    if (iteration < maxIterations) {
      output = await runBuilder({
        blueprint,
        module,
        previousOutput: output.files,
        criticFixes: lastVerdict.specificFixes,
        attempt: output.attempt + 1,
      });
    }
  }

  if (!lastVerdict) {
    throw new Error('Critic loop failed before producing a verdict');
  }

  if (!output.files) {
    output = {
      ...output,
      files: {},
      moduleId: module.id,
      attempt: output.attempt || maxIterations,
    };
  }

  return {
    output,
    verdict: lastVerdict,
    iterations: maxIterations,
    escalated: true,
  };
}
