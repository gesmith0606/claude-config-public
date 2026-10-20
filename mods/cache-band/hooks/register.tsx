import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { CacheStats } from '../types'

// Claude Code's prompt cache lives 1 hour from the last request (5 minutes under usage overage).
const TTL_MS = 60 * 60 * 1000
const SEGMENTS = 20
const TICK_MS = 30 * 1000

const stats = atom({ plugin: 'cache-band', key: 'stats' } as const, null)
const now = atom({ plugin: 'cache-band', key: 'now' } as const, 0)
const isCompacting = atom({ plugin: 'cache-band', key: 'isCompacting' } as const, false)

const hitRate =(s: CacheStats) => {
  const total = s.read + s.written + s.uncached
  return total === 0 ? 0 : Math.round((s.read / total) * 100)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const start = await $.clock.now()
    await update($, now, () => start)
    // Loaded mid-session (or hot-reloaded): seed from the last response so the band shows at once.
    if ((await read($, stats)) === null) {
      const u = (await $.session.usage({ breakdown: 'summary' })).context.breakdown?.apiUsage
      if (u) {
        await update($, stats, () => ({
          lastAt: start,
          read: u.cache_read_input_tokens,
          written: u.cache_creation_input_tokens,
          uncached: u.input_tokens,
        }))
      }
    }
    $.clock.every(TICK_MS, async () => {
      const t = await $.clock.now()
      await update($, now, () => t)
    })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // Main thread only: subagents keep caches of their own.
    if (e.agentId === undefined && e.usage) {
      const u = e.usage
      const t = await $.clock.now()
      await update($, now, () => t)
      await update($, stats, s => ({
        lastAt: t,
        read: (s?.read ?? 0) + u.cache_read_input_tokens,
        written: (s?.written ?? 0) + u.cache_creation_input_tokens,
        uncached: (s?.uncached ?? 0) + u.input_tokens,
      }))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, stats)
    if (e.props.hasSurvey || s === null) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const left = Math.max(0, TTL_MS - ((await read($, now)) - s.lastAt))
    const isWarm = left > 0
    const filled = Math.round((left / TTL_MS) * SEGMENTS)
    const busy = await read($, isCompacting)

    return (
      <Box flexDirection="row" alignItems="center" gap={1} paddingX={1}>
        <Text color={isWarm ? 'success' : 'inactive'}>●</Text>
        <Text dimColor>cache</Text>
        <Text color={isWarm ? 'success' : 'warning'} bold>
          {isWarm ? `${Math.ceil(left / 60000)}m` : 'cold'}
        </Text>
        <Text>
          <Text color="success">{'■'.repeat(filled)}</Text>
          <Text color="inactive">{'■'.repeat(SEGMENTS - filled)}</Text>
        </Text>
        <Text>
          {hitRate(s)}% <Text dimColor>hit</Text>
        </Text>
        <Box flexGrow={1} />
        <Button
          key="compact"
          label={busy ? 'Compacting…' : 'Compact'}
          onPress={async () => {
            if (busy || e.props.isWorking) return
            await update($, isCompacting, () => true)
            try {
              await $.session.compact()
            } finally {
              await update($, isCompacting, () => false)
            }
          }}
        />
      </Box>
    )
  })
}
