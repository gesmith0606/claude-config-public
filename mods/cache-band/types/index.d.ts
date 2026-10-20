/** Main-thread prompt-cache totals for this session. */
export type CacheStats = {
  /** When the last main-thread turn finished (ms since epoch); the cache TTL runs from here. */
  lastAt: number
  read: number
  written: number
  uncached: number
}

declare module 'claude-code' {
  interface PluginState {
    'cache-band': { stats: CacheStats | null; now: number; isCompacting: boolean }
  }
}
