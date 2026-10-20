import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// Stand-ins for the engine's own behaviour beneath the plugin.
const engine = (on: On) => {
  on('session.start', () => ({ cwd: '/' }))
  on('turn.complete', () => ({ text: 'ok' }))
  on('ui.render', () => h('Box', { key: 'engine' }) as RenderElement)
  // Only the field the mod reads: the last response's usage, as on a mid-session load.
  on('session.usage', () => ({ value: { context: { breakdown: { apiUsage: USAGE } } } }) as never)
}

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const USAGE = {
  model: 'claude-opus-5-5',
  input_tokens: 10,
  output_tokens: 50,
  cache_read_input_tokens: 980,
  cache_creation_input_tokens: 10,
}

test('shows cache time left and hit rate, compacts, and goes cold after the TTL', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  let compactions = 0
  on('session.compact', () => {
    compactions += 1
    return { skip: 'test' }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', usage: USAGE })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'cache-band', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: '60m' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^98% hit$/ })).toBeDefined()
    await ui.press({ key: 'compact' })
    await ui.unmount()
  }
  expect(compactions).toBe(2)

  // Subagent turns don't count toward the main cache.
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'a1', usage: { ...USAGE, cache_read_input_tokens: 0 } })

  await clock.advance(61 * 60 * 1000)
  const ui = await $.ui.mount({ plugin: 'cache-band', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: 'cold' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^98% hit$/ })).toBeDefined()
})

test('stays out of the way before the first turn', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ plugin: 'cache-band', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'compact' })).toBeUndefined()
})
