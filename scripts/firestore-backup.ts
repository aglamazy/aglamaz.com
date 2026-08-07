#!/usr/bin/env tsx
/**
 * Firestore backup/restore wrapper around gcloud.
 *
 * This keeps the repo-side contract explicit:
 * - the Firestore source project must be named
 * - the backup bucket lives in a different GCP project
 * - the caller must pass the exact export/import URI
 *
 * No defaults are used. If any required argument is missing, the script fails
 * immediately rather than guessing.
 *
 * Usage:
 *   npx tsx scripts/firestore-backup.ts export \
 *     --project famcircle-prod \
 *     --database "(default)" \
 *     --storage-project famcircle-backups \
 *     --export-uri gs://famcircle-firestore-backups/prod/2026-08-07T00-00-00Z
 *
 *   npx tsx scripts/firestore-backup.ts import \
 *     --project famcircle-scratch \
 *     --database "(default)" \
 *     --storage-project famcircle-backups \
 *     --import-uri gs://famcircle-firestore-backups/prod/2026-08-07T00-00-00Z
 */
import { execFileSync } from 'child_process';

type BackupCommand = 'export' | 'import';

function parseArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const flag = `--${name}`;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && i + 1 < argv.length) {
      return argv[i + 1];
    }

    if (argv[i].startsWith(`${flag}=`)) {
      return argv[i].split('=').slice(1).join('=');
    }
  }

  return undefined;
}

function requireArg(name: string): string {
  const value = parseArg(name);
  if (!value || !value.trim()) {
    throw new Error(`Missing required argument: --${name}`);
  }
  return value.trim();
}

function requireCommand(): BackupCommand {
  const command = process.argv[2];
  if (command !== 'export' && command !== 'import') {
    throw new Error('Usage: npx tsx scripts/firestore-backup.ts <export|import> [args]');
  }
  return command;
}

function requireGsUri(name: string, value: string): string {
  if (!value.startsWith('gs://')) {
    throw new Error(`--${name} must start with gs://`);
  }

  if (value.length <= 'gs://'.length) {
    throw new Error(`--${name} must include a bucket path`);
  }

  return value;
}

function runGcloud(args: string[]) {
  execFileSync('gcloud', args, {
    stdio: 'inherit',
  });
}

async function main() {
  const command = requireCommand();
  const project = requireArg('project');
  const database = requireArg('database');
  const storageProject = requireArg('storage-project');

  if (storageProject === project) {
    throw new Error(
      'storage-project must differ from project so the backup bucket stays in a separate blast domain'
    );
  }

  if (command === 'export') {
    const exportUri = requireGsUri('export-uri', requireArg('export-uri'));
    console.log(
      `[firestore-backup] exporting ${project}/${database} to ${exportUri} via storage project ${storageProject}`
    );
    runGcloud(['firestore', 'export', exportUri, `--project=${project}`, `--database=${database}`]);
    return;
  }

  const importUri = requireGsUri('import-uri', requireArg('import-uri'));
  console.log(
    `[firestore-backup] importing ${importUri} into ${project}/${database} via storage project ${storageProject}`
  );
  runGcloud(['firestore', 'import', importUri, `--project=${project}`, `--database=${database}`]);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[firestore-backup] failed: ${message}`);
  process.exit(1);
});
