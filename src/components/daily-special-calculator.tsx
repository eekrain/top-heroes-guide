import { createSignal, For, Show } from 'solid-js'
import { calculateShardPlan } from '../lib/shard-calculator'
import {
  compareStrategies,
  type StrategyResult,
} from '../lib/daily-special-strategies'

const formatIdr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatNumber = new Intl.NumberFormat('id-ID')

function StrategyCard(props: { strategy: StrategyResult; cheapest: boolean }) {
  return (
    <div
      class={`rounded-lg border bg-transparent p-4 ${
        props.cheapest
          ? 'border-blue-600'
          : 'border-black/15 dark:border-white/20'
      }`}
    >
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium">{props.strategy.label}</div>
        <Show when={props.cheapest}>
          <span class="rounded bg-black/10 dark:bg-white/15 px-1.5 py-0.5 text-xs text-black dark:text-white">
            Cheapest
          </span>
        </Show>
      </div>
      <div class="mt-1 text-2xl font-semibold">
        {formatIdr.format(props.strategy.cost)}
      </div>
      <div class="mt-3 flex flex-col gap-1 text-sm">
        <div class="flex justify-between">
          <span class="opacity-60">Per shard</span>
          <span>{formatIdr.format(Math.round(props.strategy.costPerShard))}</span>
        </div>
        <div class="flex justify-between">
          <span class="opacity-60">Star gems</span>
          <span>{formatNumber.format(props.strategy.gems)}</span>
        </div>
        <Show when={props.strategy.packs > 0}>
          <div class="flex justify-between">
            <span class="opacity-60">Packs</span>
            <span>{formatNumber.format(props.strategy.packs)}</span>
          </div>
        </Show>
        <Show when={props.strategy.bundleSpend > 0}>
          <div class="flex justify-between">
            <span class="opacity-60">Bundles</span>
            <span>{formatIdr.format(props.strategy.bundleSpend)}</span>
          </div>
        </Show>
        <Show when={props.strategy.plainTopUp > 0}>
          <div class="flex justify-between">
            <span class="opacity-60">Plain top-up</span>
            <span>{formatIdr.format(props.strategy.plainTopUp)}</span>
          </div>
        </Show>
        <Show when={props.strategy.goldSpent > 0}>
          <div class="flex justify-between">
            <span class="opacity-60">Gold used</span>
            <span>{formatNumber.format(props.strategy.goldSpent)}</span>
          </div>
        </Show>
        <Show when={props.strategy.goldLeft > 0}>
          <div class="flex justify-between">
            <span class="opacity-60">Gold left over</span>
            <span>{formatNumber.format(props.strategy.goldLeft)}</span>
          </div>
        </Show>
      </div>
    </div>
  )
}

export function DailySpecialCalculator() {
  const [raw, setRaw] = createSignal('400')
  const [goldRaw, setGoldRaw] = createSignal('')

  const target = () => Number.parseInt(raw(), 10)
  const valid = () => Number.isInteger(target()) && target() > 0
  const heldGold = () => Math.max(0, Number.parseInt(goldRaw(), 10) || 0)
  const plan = () => (valid() ? calculateShardPlan(target()) : null)
  const comparison = () => (valid() ? compareStrategies(target(), heldGold()) : null)

  return (
    <div class="flex flex-col gap-4 my-6">
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-sm opacity-60" for="shard-target">
          Target shards
        </label>
        <input
          id="shard-target"
          type="number"
          min={1}
          inputmode="numeric"
          value={raw()}
          onInput={(e) => setRaw(e.currentTarget.value)}
          class="w-32 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-1.5 text-sm"
        />
        <label class="ml-auto text-sm opacity-60" for="held-gold">
          Gold blocks you hold
        </label>
        <input
          id="held-gold"
          type="number"
          min={0}
          inputmode="numeric"
          placeholder="0"
          value={goldRaw()}
          onInput={(e) => setGoldRaw(e.currentTarget.value)}
          class="w-36 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-1.5 text-sm"
        />
      </div>

      <Show
        when={comparison() && plan()}
        fallback={
          <p class="text-sm opacity-60">Enter a positive number of shards.</p>
        }
      >
        <p class="text-sm opacity-60">
          {formatNumber.format(plan()!.actualShards)} shards over{' '}
          {formatNumber.format(plan()!.days)} {plan()!.days === 1 ? 'day' : 'days'}
          <Show when={plan()!.overshoot > 0}>
            <span class="ml-2 rounded bg-black/10 dark:bg-white/15 px-1.5 py-0.5 text-xs text-black dark:text-white">
              +{formatNumber.format(plan()!.overshoot)} overshoot
            </span>
          </Show>
        </p>

        <div class="grid gap-3 md:grid-cols-2">
          <For each={[comparison()!.vouchers, comparison()!.cheapest]}>
            {(strategy) => (
              <StrategyCard
                strategy={strategy}
                cheapest={comparison()!.cheapestId === strategy.id}
              />
            )}
          </For>
        </div>

        <div class="text-sm font-medium">Voucher plan schedule</div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-black/15 dark:border-white/20 text-left opacity-60">
              <th class="py-2 font-medium">Days</th>
              <th class="py-2 font-medium">Vouchers</th>
              <th class="py-2 font-medium">Shards</th>
            </tr>
          </thead>
          <tbody>
            <For each={plan()!.schedule}>
              {(entry) => (
                <tr class="border-b border-black/15 dark:border-white/20">
                  <td class="py-2">
                    {entry.fromDay === entry.toDay
                      ? formatNumber.format(entry.fromDay)
                      : `${formatNumber.format(entry.fromDay)}–${formatNumber.format(entry.toDay)}`}
                  </td>
                  <td class="py-2">{formatNumber.format(entry.vouchers)}</td>
                  <td class="py-2">{formatNumber.format(entry.shards)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  )
}
