declare module '@playwright/test' {
  export const devices: Record<string, Record<string, unknown>>;
  export function defineConfig<T extends Record<string, unknown>>(config: T): T;
}
