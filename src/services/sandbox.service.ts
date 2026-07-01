import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function compileTypeScript(
  code: string
): Promise<{ success: boolean; errors: string }> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-ts-'));
  const tempFile = path.join(tempDir, `${uuidv4()}.ts`);

  try {
    fs.writeFileSync(tempFile, code, 'utf8');

    execSync(
      `npx tsc "${tempFile}" --noEmit --strict --target ES2020 --moduleResolution node`,
      {
        encoding: 'utf8',
        timeout: 30000,
        stdio: 'pipe',
      }
    );

    return { success: true, errors: '' };
  } catch (error) {
    const errors =
      error instanceof Error && 'stderr' in error
        ? String((error as Error & { stderr?: Buffer | string }).stderr || error.message)
        : error instanceof Error
          ? error.message
          : String(error);

    return { success: false, errors };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
