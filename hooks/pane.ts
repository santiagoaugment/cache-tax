import type { Elements, RenderNode } from 'claude-code'

export const PANE = 'cache-tax'

export type CacheState = 'warm' | 'cold' | 'unknown' | 'stopped'

/** Everything the pane shows, already worded by register.ts, which owns the pricing and the clock. */
export type PaneModel = {
  state: CacheState
  headline: string
  /** Share of the one-hour TTL still left: 1 just after a request, 0 once cold, null before the first turn. */
  ttlLeft: number | null
  model: string
  context: string
  warmTurn: string
  coldWrite: string
  ratio: string | null
  keepwarm: { left: string; next: string; share: number; always: boolean } | null
  stopped: string | null
  pings: Array<{ ago: string; read: string; write: string; usd: string; warm: boolean }>
  pingTotal: string
  coldWrites: string
  guard: 'refuse' | 'warn'
}

export type PaneActions = {
  warm: (windowMs: number) => Promise<void>
  off: () => Promise<void>
  toggleGuard: () => Promise<void>
}

const LABEL = 11
const MAX_PINGS = 6

export function bar(share: number, width: number): [string, string] {
  const filled = Math.round(Math.max(0, Math.min(1, share)) * width)
  return ['█'.repeat(filled), '░'.repeat(width - filled)]
}

type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export function drawPane(
  { Box, Text, Button }: Els,
  bodyColumns: number,
  m: PaneModel,
  look: { icon: RenderNode; color: string | undefined },
  act: PaneActions,
): RenderNode {
  const width = Math.max(12, Math.min(48, bodyColumns - 2))

  const heading = (text: string, aside?: string) => Box({ marginTop: 1, children: [
    Text({ bold: true, dimColor: true, children: [text] }),
    ...(aside ? [Text({ dimColor: true, children: [`  ${aside}`] })] : []),
  ] })
  const row = (label: string, value: string, color?: string) => Box({ flexDirection: 'row', children: [
    Box({ width: LABEL, flexShrink: 0, children: [Text({ dimColor: true, children: [label] })] }),
    Text({ color, wrap: 'truncate-end', children: [value] }),
  ] })
  const meter = (share: number, color: string | undefined) => {
    const [full, empty] = bar(share, width)
    return Text({ children: [Text({ color, children: [full] }), Text({ dimColor: true, children: [empty] })] })
  }

  const header = Box({ flexDirection: 'column', children: [
    Box({ flexDirection: 'row', alignItems: 'center', children: [
      Box({ flexShrink: 0, children: [look.icon] }),
      Text({ children: [' '] }),
      Text({ color: look.color, bold: true, children: [m.state] }),
    ] }),
    Text({ dimColor: true, children: [m.headline] }),
    ...(m.ttlLeft === null ? [] : [meter(m.ttlLeft, look.color)]),
  ] })

  const cache = Box({ flexDirection: 'column', children: [
    heading('CACHE'),
    row('context', m.context),
    row('model', m.model),
    row('warm turn', m.warmTurn),
    row('cold write', m.coldWrite, m.state === 'cold' ? look.color : undefined),
    ...(m.ratio ? [Text({ dimColor: true, wrap: 'wrap', children: [m.ratio] })] : []),
  ] })

  const keepwarm = Box({ flexDirection: 'column', children: [
    heading('KEEPWARM', m.keepwarm?.always ? 'always' : undefined),
    ...(m.keepwarm
      ? [row('left', m.keepwarm.left), row('next ping', m.keepwarm.next), meter(m.keepwarm.share, undefined)]
      : m.stopped
        ? [Text({ color: 'warning', wrap: 'wrap', children: [`stopped: ${m.stopped}`] })]
        : [Text({ dimColor: true, children: ['off'] })]),
    Box({ flexDirection: 'row', columnGap: 1, marginTop: 1, children: [
      Button({ key: 'warm-90m', label: '90m', hotkey: '1', onPress: () => act.warm(90 * 60 * 1000) }),
      Button({ key: 'warm-6h', label: '6h', hotkey: '6', variant: m.keepwarm ? undefined : 'primary', onPress: () => act.warm(6 * 60 * 60 * 1000) }),
      ...(m.keepwarm ? [Button({ key: 'warm-off', label: 'off', hotkey: 'o', onPress: act.off })] : []),
    ] }),
  ] })

  const shown = m.pings.slice(-MAX_PINGS).reverse()
  const pings = Box({ flexDirection: 'column', children: [
    heading('PINGS', m.pings.length ? `${m.pings.length} ping${m.pings.length === 1 ? '' : 's'} · ${m.pingTotal}` : undefined),
    ...(shown.length
      ? shown.map(p => Text({ wrap: 'truncate-end', children: [
          Text({ color: p.warm ? 'success' : 'warning', children: [p.warm ? '✓ ' : '✗ '] }),
          Text({ dimColor: true, children: [p.ago.padEnd(9)] }),
          `read ${p.read}`,
          p.warm ? '' : ` wrote ${p.write}`,
          Text({ dimColor: true, children: [`  ${p.usd}`] }),
        ] }))
      : [Text({ dimColor: true, children: ['no pings yet'] })]),
  ] })

  const session = Box({ flexDirection: 'column', children: [
    heading('SESSION'),
    row('cold paid', m.coldWrites),
    Box({ flexDirection: 'row', children: [
      Box({ width: LABEL, flexShrink: 0, children: [Text({ dimColor: true, children: ['guard'] })] }),
      Text({ children: [m.guard === 'refuse' ? 'refuse once ' : 'warn only '] }),
      Button({ key: 'guard', label: m.guard === 'refuse' ? 'warn' : 'refuse', hotkey: 'g', dimColor: true, onPress: act.toggleGuard }),
    ] }),
  ] })

  return Box({ flexDirection: 'column', children: [header, cache, keepwarm, pings, session] })
}
