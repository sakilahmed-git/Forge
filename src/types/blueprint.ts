import { v4 as uuid } from 'uuid';

export type DeploymentTarget = 'personal' | 'startup' | 'enterprise';
export type AgentStatus = 'pending' | 'running' | 'approved' | 'rejected' | 'escalated';
export type ModuleId = 'auth' | 'db' | 'routes' | 'frontend' | string;

export interface ExportDefinition {
  name: string;
  type: 'function' | 'class' | 'const' | 'interface' | 'type';
  signature: string;
  filePath: string;
}

export interface ImportDefinition {
  name: string;
  fromModule: ModuleId;
  filePath: string;
}

export interface FileDefinition {
  path: string;
  description: string;
}

export interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  requestBody?: string;
  response: string;
  protected: boolean;
}

export interface SchemaDefinition {
  name: string;
  fields: Record<string, string>;
  indexes: string[];
}

export interface EnvVar {
  key: string;
  example: string;
  required: boolean;
}

export interface SharedFile {
  path: string;
  content: string;
}

export interface Module {
  id: ModuleId;
  ownerAgent: string;
  description: string;
  files: FileDefinition[];
  exports: ExportDefinition[];
  imports: ImportDefinition[];
  acceptanceCriteria: string[];
  dependencies: ModuleId[];
}

export interface TechStack {
  runtime: string;
  framework: string;
  database: string;
  auth: string;
  frontend: string;
  language: string;
}

export interface Blueprint {
  id: string;
  userPrompt: string;
  projectName: string;
  techStack: TechStack;
  deploymentTarget: DeploymentTarget;
  modules: Module[];
  apiContracts: Endpoint[];
  dbSchema: SchemaDefinition[];
  envVars: EnvVar[];
  sharedFiles: SharedFile[];
  executionOrder: ModuleId[][];
  assumptions: string[];
  createdAt: Date;
}

export interface AgentOutput {
  runId: string;
  moduleId: ModuleId;
  agentId: string;
  output: Record<string, string>;
  iterations: number;
  escalated: boolean;
  approvedAt: Date;
}

export interface ForgeResult {
  runId: string;
  blueprint: Blueprint;
  outputs: AgentOutput[];
  finalCode: Record<string, string>;
  stats: {
    totalTime: number;
    totalIterations: number;
    escalations: number;
    agentTimes: Record<string, number>;
  };
}