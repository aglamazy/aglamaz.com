import packageJson from '@/../package.json';

/**
 * Get the application version from package.json
 */
export function getVersion(): string {
  return packageJson.version;
}
