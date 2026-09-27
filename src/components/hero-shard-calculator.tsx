import { createSignal, For } from 'solid-js'
import {
  calculateShards,
  type HeroTier,
  type StarState,
} from '../lib/hero-shard-calculator'

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

function StatePicker(props: {
  id: string
  label: string
  state: StarState
  onChange: (next: StarState) => void
}) {
  return (
    <div class="flex flex-col gap-1">
      <label class="text-sm opacity-60" for={`${props.id}-level`}>
        {props.label}
      </label>
      <div class="flex gap-2">
        <select
          id={`${props.id}-level`}
          value={props.state.level}
          onInput={(e) => props.onChange({ ...props.state, level: Number(e.currentTarget.value) })}
          class="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1.5 text-sm"
        >
          <For each={PHASES}>
            {(phase) => (
              <optgroup label={phase.name}>
                <For each={LEVELS.filter((l) => l.phase === phase.name)}>
                  {(level) => <option value={level.level}>{level.label}</option>}
                </For>
              </optgroup>
            )}
          </For>
        </select>
        <select
          aria-label={`${props.label} step`}
          value={props.state.step}
          onInput={(e) => props.onChange({ ...props.state, step: Number(e.currentTarget.value) })}
          class="w-20 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1.5 text-sm"
        >
          <For each={STEPS}>
            {(step) => <option value={step}>{step}/5</option>}
          </For>
        </select>
      </div>
    </div>
  )
}

export function HeroShardCalculator() {
  const [tier, setTier] = createSignal<HeroTier>('legendary')
  const [current, setCurrent] = createSignal<StarState>({ level: 1, step: 0 })
  const [inventoryRaw, setInventoryRaw] = createSignal('')

  const inventory = () => Math.max(0, Number.parseInt(inventoryRaw(), 10) || 0)
  const result = () => calculateShards(tier(), current(), MAX_TARGET, inventory())

  return (
    <div class="flex flex-col gap-4 my-6">
      <div class="flex flex-wrap gap-4">
        <For each={['legendary', 'mythic'] as const}>
          {(t) => (
            <label class="flex items-center gap-2 text-sm capitalize">
              <input
                type="radio"
                name="hero-tier"
                checked={tier() === t}
                onChange={() => setTier(t)}
              />
              {t} <span class="opacity-60">({t === 'mythic' ? '×2' : '×1'})</span>
            </label>
          )}
        </For>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <StatePicker id="current" label="Current" state={current()} onChange={setCurrent} />

        <div class="flex flex-col gap-1">
          <label class="text-sm opacity-60" for="inventory">
            Inventory shards (optional)
          </label>
          <input
            id="inventory"
            type="number"
            min={0}
            inputmode="numeric"
            value={inventoryRaw()}
            onInput={(e) => setInventoryRaw(e.currentTarget.value)}
            class="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-1.5 text-sm md:w-auto"
          />
        </div>
      </div>

      <div class="rounded-lg border border-black/15 dark:border-white/20 p-4">
        <div class="flex justify-between text-sm">
          <span class="opacity-60">
            {levelLabel(current().level)} {current().step}/5 → 5★ White 5/5
          </span>
          <span class="capitalize">{tier()}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div class="text-sm opacity-60">Shards needed</div>
            <div class="text-2xl font-semibold">
              {formatNumber.format(result().totalNeeded)}
            </div>
          </div>
          <div>
            <div class="text-sm opacity-60">Still to farm</div>
            <div class="text-2xl font-semibold">
              {formatNumber.format(result().netNeeded)}
            </div>
          </div>
        </div>
        <div class="mt-4">
          <div class="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
            <div
              class="h-full rounded-full bg-blue-600"
              style={{ width: `${result().progressPercent}%` }}
            />
          </div>
          <div class="mt-1 text-right text-xs opacity-60">
            {result().progressPercent.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}
