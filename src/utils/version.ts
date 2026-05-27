import packageJson from '@/../package.json';

/**
 * Get the application version, formatted as yy.mm.# (e.g. 26.05.1).
 * Source of truth is package.json (semver, so mm is unpadded there).
 * Falls back to the raw value if it doesn't parse as 3 numeric parts.
 */
export function getVersion(): string {
  const raw = packageJson.version;
  const parts = raw.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return raw;
  const [yy, mm, n] = parts;
  return `${yy.padStart(2, '0')}.${mm.padStart(2, '0')}.${n}`;
}
