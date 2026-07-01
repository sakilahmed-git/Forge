import { v4 as uuid } from 'uuid';
import { callLLMJSON } from '../services/openai.service';
import {
  Blueprint,
  DeploymentTarget,
  EnvVar,
  ExportDefinition,
  FileDefinition,
  ImportDefinition,
  Module,
  ModuleId,
  SchemaDefinition,
  SharedFile,
  TechStack,
  Endpoint,
} from '../types/blueprint';
import { topoSort } from '../utils/topo-sort';

const ARCHITECT_SYSTEM_PROMPT = `You are the Architect agent in FORGE, an autonomous coding system.
Your ONLY job is to design. You write ZERO lines of code.

Given a user prompt, produce a complete Blueprint JSON object.
This Blueprint coordinates all builder agents. It must be precise.

Rules:
1. Define EXACT function names in exports — not vague descriptions
2. Define EXACT file paths for every file to be created
3. Use only these moduleIds: 'auth', 'db', 'routes', 'frontend'
4. Set dependencies correctly — routes depends on auth and db, frontend depends on routes
5. Write 5+ specific acceptance criteria per module for the Critic to evaluate
6. List ALL environment variables needed
7. Document every assumption made
8. NEVER invent features not in the prompt
9. Respond ONLY with valid JSON matching the Blueprint interface exactly
10. executionOrder must be the topological sort result: [['auth','db'],['routes'],['frontend']]

Blueprint interface:
{
  id: string,
  userPrompt: string,
  projectName: string,
  techStack: { runtime, framework, database, auth, frontend, language },
  deploymentTarget: 'personal' | 'startup' | 'enterprise',
  modules: [{
    id: string,
    ownerAgent: string,
    description: string,
    files: [{ path: string, description: string }],
    exports: [{ name: string, type: string, signature: string, filePath: string }],
    imports: [{ name: string, fromModule: string, filePath: string }],
    acceptanceCriteria: string[],
    dependencies: string[]
  }],
  apiContracts: [{ method, path, description, requestBody?, response, protected: boolean }],
  dbSchema: [{ name: string, fields: Record<string,string>, indexes: string[] }],
  envVars: [{ key: string, example: string, required: boolean }],
  sharedFiles: [{ path: string, content: string }],
  executionOrder: string[][],
  assumptions: string[],
  createdAt: string
}`;

function validateDeploymentTarget(value: string): DeploymentTarget {
  if (value === 'personal' || value === 'startup' || value === 'enterprise') {
    return value;
  }

  throw new Error(`Architect produced invalid blueprint: invalid deploymentTarget ${value}`);
}

function validateArchitectBlueprint(blueprint: Blueprint): void {
  if (!Array.isArray(blueprint.modules)) {
    throw new Error('Architect produced invalid blueprint: modules must be an array');
  }

  if (blueprint.modules.length !== 4) {
    throw new Error('Architect produced invalid blueprint: modules must contain exactly 4 modules');
  }

  if (!Array.isArray(blueprint.executionOrder) || blueprint.executionOrder.length === 0) {
    throw new Error('Architect produced invalid blueprint: executionOrder is required');
  }
}

export async function runArchitect(
  userPrompt: string,
  deploymentTarget: string
): Promise<Blueprint> {
  const target = validateDeploymentTarget(deploymentTarget);
  const userMessage = `${userPrompt}\n\ndeploymentTarget: ${target}`;

  const blueprint = await callLLMJSON<Blueprint>(ARCHITECT_SYSTEM_PROMPT, userMessage);

  blueprint.id = uuid();
  blueprint.userPrompt = userPrompt;
  blueprint.deploymentTarget = target;
  blueprint.createdAt = new Date();

  validateArchitectBlueprint(blueprint);

  blueprint.executionOrder = topoSort(
    blueprint.modules.map((module) => ({
      id: module.id,
      dependencies: module.dependencies,
    }))
  ) as ModuleId[][];

  return blueprint;
}

export type {
  Blueprint,
  DeploymentTarget,
  EnvVar,
  ExportDefinition,
  FileDefinition,
  ImportDefinition,
  Module,
  ModuleId,
  SchemaDefinition,
  SharedFile,
  TechStack,
  Endpoint,
};
