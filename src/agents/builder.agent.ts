import { callLLM, callLLMJSON } from '../services/openai.service';
import { Blueprint, FileDefinition, ImportDefinition, Module } from '../types/blueprint';

export interface BuilderInput {
  blueprint: Blueprint;
  module: Module;
  previousOutput?: Record<string, string>;
  criticFixes?: string[];
  attempt: number;
}

export interface BuilderOutput {
  files: Record<string, string>;
  moduleId: string;
  attempt: number;
}

interface BuilderResponse {
  files: Record<string, string>;
}

const BUILDER_SYSTEM_PROMPT = `You are a Builder agent. Build the assigned module files.
Rules:
- Use EXACT export names specified
- Use EXACT file paths specified  
- TypeScript strict mode, no 'any'
- async/await only, no .then()
- Single quotes, 2-space indent
- Named exports only
- Handle all errors with try/catch
- Respond ONLY with: {"files": {"filepath": "content"}}`;

const FALLBACK_SYSTEM_PROMPT = `You are a Builder agent. Build the assigned module files.
Respond ONLY with: {"files": {"filepath": "content"}}`;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function oneLineDescription(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function splitFileGroups(files: FileDefinition[]): FileDefinition[][] {
  const mid = Math.ceil(files.length / 2);
  return [files.slice(0, mid), files.slice(mid)];
}

function filterExportsForFiles(
  exports: Module['exports'],
  files: FileDefinition[]
) {
  const filePaths = new Set(files.map((file) => file.path));
  return exports
    .filter((item) => filePaths.has(item.filePath))
    .map(({ name, filePath }) => ({ name, filePath }));
}

function buildPayload(
  input: BuilderInput,
  files: FileDefinition[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    moduleId: input.module.id,
    moduleDescription: input.module.description,
    files: files.map((file) => ({
      path: file.path,
      description: oneLineDescription(file.description),
    })),
    exports: filterExportsForFiles(input.module.exports, files),
    imports: input.module.imports.map((item) => ({
      name: item.name,
      fromModule: item.fromModule,
      filePath: item.filePath,
    })),
    acceptanceCriteria: input.module.acceptanceCriteria,
    deploymentTarget: input.blueprint.deploymentTarget,
  };

  if (input.attempt > 1) {
    const previousOutputForFiles = files.reduce<Record<string, string>>((acc, file) => {
      if (input.previousOutput?.[file.path]) {
        acc[file.path] = input.previousOutput[file.path];
      }
      return acc;
    }, {});

    if (Object.keys(previousOutputForFiles).length > 0) {
      payload.previousOutput = previousOutputForFiles;
    }

    if (input.criticFixes?.length) {
      payload.specificFixes = input.criticFixes;
    }
  }

  return payload;
}

function buildTrimmedPayload(
  input: BuilderInput,
  files: FileDefinition[]
): Record<string, unknown> {
  return {
    moduleId: input.module.id,
    filePaths: files.map((file) => file.path),
    exportNames: filterExportsForFiles(input.module.exports, files).map((item) => ({
      name: item.name,
      filePath: item.filePath,
    })),
    importNames: input.module.imports.map((item) => ({
      name: item.name,
      fromModule: item.fromModule,
      filePath: item.filePath,
    })),
    acceptanceCriteria: input.module.acceptanceCriteria,
    deploymentTarget: input.blueprint.deploymentTarget,
    previousOutput:
      input.attempt > 1
        ? files.reduce<Record<string, string>>((acc, file) => {
            if (input.previousOutput?.[file.path]) {
              acc[file.path] = input.previousOutput[file.path];
            }
            return acc;
          }, {})
        : undefined,
    specificFixes: input.attempt > 1 ? input.criticFixes : undefined,
  };
}

async function buildFileGroup(
  input: BuilderInput,
  files: FileDefinition[]
): Promise<Record<string, string>> {
  const payload = buildPayload(input, files);
  let userMessage = JSON.stringify(payload, null, 2);

  if (estimateTokens(`${BUILDER_SYSTEM_PROMPT}${userMessage}`) > 3000) {
    userMessage = JSON.stringify(buildTrimmedPayload(input, files), null, 2);
  }

  try {
    const response = await callLLMJSON<BuilderResponse>(BUILDER_SYSTEM_PROMPT, userMessage);
    return response.files;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Groq returned invalid JSON')) {
      console.log('Builder JSON parse failed, retrying with simpler prompt.');

      const fallbackPayload = {
        files: files.map((file) => ({
          path: file.path,
          description: oneLineDescription(file.description),
        })),
      };

      const raw = await callLLM(FALLBACK_SYSTEM_PROMPT, JSON.stringify(fallbackPayload, null, 2));
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        const parsed = JSON.parse(cleaned) as BuilderResponse;
        return parsed.files;
      } catch (secondError) {
        console.error(
          'Builder JSON parse failed, returning stubs',
          secondError
        );

        return Object.fromEntries(
          files.map((file) => [
            file.path,
            `// ${input.module.id} module — generation failed, stub file\nexport const ${input.module.id} = {};`,
          ])
        );
      }
    }

    throw error;
  }
}

export async function runBuilder(input: BuilderInput): Promise<BuilderOutput> {
  const fileGroups = input.module.files.length > 2 ? splitFileGroups(input.module.files) : [input.module.files];
  const results = await Promise.all(fileGroups.map((group) => buildFileGroup(input, group)));
  const files = Object.assign({}, ...results);

  return {
    files,
    moduleId: input.module.id,
    attempt: input.attempt,
  };
}
