import fs from 'fs';
import path from 'path';
import { callLLM, callLLMJSON } from '../services/openai.service';
import { compileTypeScript } from '../services/sandbox.service';
import { Blueprint } from '../types/blueprint';
import { BuilderOutput } from './builder.agent';

export interface IntegratorInput {
  blueprint: Blueprint;
  outputs: BuilderOutput[];
}

export interface IntegratorOutput {
  files: Record<string, string>;
  success: boolean;
  compilationErrors: string;
  fixAttempts: number;
}

interface FixedIntegrationResponse {
  files: Record<string, string>;
}

function defaultPackageJson(blueprint: Blueprint): string {
  return JSON.stringify(
    {
      name: blueprint.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      version: '1.0.0',
      main: 'dist/index.js',
      scripts: {
        dev: 'ts-node src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
      },
      dependencies: {
        cors: '^2.8.5',
        dotenv: '^16.4.5',
        express: '^4.18.3',
        helmet: '^7.1.0',
        mongoose: '^8.2.0',
      },
      devDependencies: {
        '@types/cors': '^2.8.17',
        '@types/express': '^4.17.21',
        '@types/node': '^20.11.30',
        'ts-node': '^10.9.2',
        typescript: '^5.4.3',
      },
    },
    null,
    2
  );
}

function defaultTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020', 'DOM'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2
  );
}

function getSharedFile(blueprint: Blueprint, filePath: string): string | undefined {
  return blueprint.sharedFiles.find((file) => file.path === filePath)?.content;
}

function findRouteFiles(files: Record<string, string>): string[] {
  return Object.keys(files).filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/routes/') && normalized.endsWith('.ts');
  });
}

function toImportPath(fromFile: string, targetFile: string): string {
  const relativePath = path
    .relative(path.dirname(fromFile), targetFile)
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '');

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function generateIndexTs(files: Record<string, string>): string {
  const indexPath = 'src/index.ts';
  const routeFiles = findRouteFiles(files);
  const imports = routeFiles
    .map((routeFile, index) => `import route${index} from '${toImportPath(indexPath, routeFile)}';`)
    .join('\n');
  const mounts = routeFiles
    .map((routeFile, index) => {
      const baseName = path.basename(routeFile, '.ts').replace(/\.routes?$/i, '');
      const routePath = baseName === 'index' ? '/api' : `/api/${baseName}`;
      return `app.use('${routePath}', route${index});`;
    })
    .join('\n');

  return `import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';

${imports}

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error('MONGODB_URI environment variable is required');
}

app.use(helmet());
app.use(cors());
app.use(express.json());
${mounts ? `\n${mounts}` : ''}

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function startServer(): Promise<void> {
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
  app.listen(port, () => {
    console.log(\`Server running on port \${port}\`);
  });
}

void startServer();
`;
}

function combineFiles(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([filePath, content]) => `// FILE: ${filePath}\n${content}`)
    .join('\n\n');
}

export async function resolveConflict(
  filepath: string,
  versionA: string,
  versionB: string,
  blueprint: Blueprint
): Promise<string> {
  return callLLM(
    'You are resolving a file conflict in FORGE. Two agents produced different versions of the same file. Pick the better one or merge them. Return ONLY the final file content.',
    JSON.stringify(
      {
        filepath,
        versionA,
        versionB,
        blueprint,
      },
      null,
      2
    )
  );
}

export async function fixIntegration(
  files: Record<string, string>,
  errors: string,
  blueprint: Blueprint,
  attempt: number
): Promise<Record<string, string>> {
  const response = await callLLMJSON<FixedIntegrationResponse>(
    'You are the Integrator fixing compilation errors in assembled code. Fix ONLY what is broken. Return complete fixed files as JSON: { files: { filepath: content } }',
    JSON.stringify(
      {
        attempt,
        errors,
        files,
        blueprint,
      },
      null,
      2
    )
  );

  return response.files;
}

export async function runIntegrator(input: IntegratorInput): Promise<IntegratorOutput> {
  let files: Record<string, string> = {};

  for (const output of input.outputs) {
    for (const [filePath, content] of Object.entries(output.files)) {
      if (files[filePath] === undefined) {
        files[filePath] = content;
      } else {
        files[filePath] = await resolveConflict(filePath, files[filePath], content, input.blueprint);
      }
    }
  }

  files['package.json'] = getSharedFile(input.blueprint, 'package.json') || defaultPackageJson(input.blueprint);
  files['tsconfig.json'] = getSharedFile(input.blueprint, 'tsconfig.json') || defaultTsConfig();
  files['src/index.ts'] = generateIndexTs(files);

  let compilation = await compileTypeScript(combineFiles(files));
  let fixAttempts = 0;

  while (!compilation.success && fixAttempts < 2) {
    fixAttempts += 1;
    files = await fixIntegration(files, compilation.errors, input.blueprint, fixAttempts);
    compilation = await compileTypeScript(combineFiles(files));
  }

  return {
    files,
    success: compilation.success,
    compilationErrors: compilation.errors,
    fixAttempts,
  };
}
