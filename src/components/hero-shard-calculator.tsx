import { useState } from 'react'
import {
  calculateShards,
  type HeroTier,
  type StarState,
} from '@/lib/hero-shard-calculator'

const PHASES = [
  { name: 'Yellow', from: 1, to: 5 },
  { name: 'Red', from: 6, to: 10 },
  { name: 'White', from: 11, to: 15 },
] as const

const LEVELS = PHASES.flatMap((phase) =>
  Array.from({ length: phase.to - phase.from + 1 }, (_, i) => ({
    level: phase.from + i,
    label: `${i + 1}★ ${phase.name}`,
    phase: phase.name,
  })),
)

const STEPS = [0, 1, 2, 3, 4, 5]

const MAX_TARGET: StarState = { level: 15, step: 5 }

const formatNumber = new Intl.NumberFormat('id-ID')

function levelLabel(level: number): string {
  return LEVELS.find((l) => l.level === level)?.label ?? `Lv ${level}`
}

function StatePicker({
  id,
  label,
  state,
  onChange,
}: {
  id: string
  label: string
  state: StarState
  onChange: (next: StarState) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-fd-muted-foreground" htmlFor={`${id}-level`}>
        {label}
      </label>
      <div className="flex gap-2">
        <select
          id={`${id}-level`}
          value={state.level}
          onChange={(e) => onChange({ ...state, level: Number(e.target.value) })}
          className="flex-1 rounded-md border border-fd-border bg-fd-card px-2 py-1.5 text-sm"
        >
          {PHASES.map((p) => (
            <optgroup key={p.name} label={p.name}>
              {LEVELS.filter((l) => l.phase === p.name).map((l) => (
                <option key={l.level} value={l.level}>
                  {l.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          aria-label={`${label} step`}
          value={state.step}
          onChange={(e) => onChange({ ...state, step: Number(e.target.value) })}
          className="w-20 rounded-md border border-fd-border bg-fd-card px-2 py-1.5 text-sm"
        >
          {STEPS.map((s) => (
            <option key={s} value={s}>
              {s}/5
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function HeroShardCalculator() {
  const [tier, setTier] = useState<HeroTier>('legendary')
  const [current, setCurrent] = useState<StarState>({ level: 1, step: 0 })
  const [inventoryRaw, setInventoryRaw] = useState('')

  const inventory = Math.max(0, Number.parseInt(inventoryRaw, 10) || 0)
  const result = calculateShards(tier, current, MAX_TARGET, inventory)

  return (
    <div className="flex flex-col gap-4 not-prose">
      <div className="flex flex-wrap gap-4">
        {(['legendary', 'mythic'] as const).map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm capitalize">
            <input
              type="radio"
              name="hero-tier"
              checked={tier === t}
              onChange={() => setTier(t)}
            />
            {t} <span className="text-fd-muted-foreground">({t === 'mythic' ? '×2' : '×1'})</span>
          </label>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatePicker id="current" label="Current" state={current} onChange={setCurrent} />

        <div className="flex flex-col gap-1">
          <label className="text-sm text-fd-muted-foreground" htmlFor="inventory">
            Inventory shards (optional)
          </label>
          <input
            id="inventory"
            type="number"
            min={0}
            inputMode="numeric"
            value={inventoryRaw}
            onChange={(e) => setInventoryRaw(e.target.value)}
            className="w-full rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-sm md:w-auto"
          />
        </div>
      </div>

      <div className="rounded-lg border border-fd-border bg-fd-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-fd-muted-foreground">
            {levelLabel(current.level)} {current.step}/5 → 5★ White 5/5
          </span>
          <span className="capitalize">{tier}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-fd-muted-foreground">Shards needed</div>
            <div className="text-2xl font-semibold">
              {formatNumber.format(result.totalNeeded)}
            </div>
          </div>
          <div>
            <div className="text-sm text-fd-muted-foreground">Still to farm</div>
            <div className="text-2xl font-semibold">
              {formatNumber.format(result.netNeeded)}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-fd-muted">
            <div
              className="h-full rounded-full bg-fd-primary"
              style={{ width: `${result.progressPercent}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-fd-muted-foreground">
            {result.progressPercent.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}
