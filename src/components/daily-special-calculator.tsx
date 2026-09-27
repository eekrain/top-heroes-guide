import { createSignal, For, Show } from 'solid-js'
import { calculateShardPlan } from '../lib/shard-calculator'
import {
  buildDailyPlan,
  compareStrategies,
  type PlanAction,
  type StrategyResult,
} from '../lib/daily-special-strategies'

const formatIdr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatNumber = new Intl.NumberFormat('id-ID')

const BUNDLE_NAMES: Record<number, string> = {
  77_000: 'Small',
  155_000: 'Medium',
  310_000: 'Large',
}

type PlanRow =
  | { kind: 'day'; day: number }
  | { kind: 'action'; action: PlanAction }

function PlanHeader(props: { row: PlanRow }) {
  return <p class="mt-3 text-sm font-semibold first:mt-0">Day {props.row.day}</p>
}

function PlanLine(props: { row: PlanRow }) {
  const action = () => props.row.action
  return (
    <Show
      when={action().kind === 'tier'}
      fallback={
        <Show
          when={action().kind === 'buy-bundles'}
          fallback={
            <p class="ml-4 py-0.5 text-sm">
              Buy{' '}
              {formatNumber.format((action() as { packs: number }).packs)} Daily Deal Activation{' '}
              {(action() as { packs: number }).packs === 1 ? 'Pack' : 'Packs'} —{' '}
              {formatIdr.format((action() as { cost: number }).cost)}
              <Show when={(action() as { vouchersAfter: number }).vouchersAfter > 0}>
                <span class="opacity-60">
                  {' '}
                  ({formatNumber.format((action() as { vouchersAfter: number }).vouchersAfter)}{' '}
                  vouchers left)
                </span>
              </Show>
            </p>
          }
        >
          <For
            each={(action() as { bundles: { price: number; count: number; gold: number }[] }).bundles}
          >
            {(bundle) => (
              <p class="ml-4 py-0.5 text-sm text-cyan-300">
                Buy {formatNumber.format(bundle.count)}×{' '}
                {BUNDLE_NAMES[bundle.price] ?? 'Gold'} bundle ({formatIdr.format(bundle.price * bundle.count)}) → +
                {formatNumber.format(bundle.gold * bundle.count)} gold
              </p>
            )}
          </For>
        </Show>
      }
    >
      <p class="ml-4 py-0.5 text-sm">
        Tier {(action() as { tier: number }).tier} —{' '}
        <Show
          when={(action() as { payment: string }).payment === 'gold'}
          fallback={
            <span>
              use {formatNumber.format((action() as { vouchers: number }).vouchers || 0)} vouchers
            </span>
          }
        >
          <span class="text-cyan-300">
            pay {formatNumber.format((action() as { goldCost: number }).goldCost || 0)} gold
          </span>
        </Show>{' '}
        → {formatNumber.format((action() as { shards: number }).shards)} shards, +
        {formatNumber.format((action() as { gems: number }).gems)} gems
      </p>
    </Show>
  )
}

function StrategyCard(props: {
  strategy: StrategyResult;
  cheapest: boolean;
  onPlan: () => void;
}) {
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
            <span class="opacity-60">Voucher packs</span>
            <span>{formatNumber.format(props.strategy.packs)}</span>
          </div>
        </Show>
        <Show when={props.strategy.bundleSpend > 0}>
          <div class="flex justify-between">
            <span class="opacity-60">Gold bundles bought</span>
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
            <span class="opacity-60">Gold spent</span>
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

      <button
        type="button"
        onClick={() => props.onPlan()}
        class="mt-4 w-full rounded-md border border-white/20 py-1.5 text-xs opacity-80 transition hover:opacity-100 hover:bg-white/10"
      >
        See day-by-day plan
      </button>
    </div>
  )
}

export function DailySpecialCalculator() {
  const [raw, setRaw] = createSignal('400')
  const [goldRaw, setGoldRaw] = createSignal('')
  const [planStrategy, setPlanStrategy] = createSignal<'cheapest' | 'vouchers'>('cheapest')
  let planDialog: HTMLDialogElement | undefined

  const target = () => Number.parseInt(raw(), 10)
  const valid = () => Number.isInteger(target()) && target() > 0
  const heldGold = () => Math.max(0, Number.parseInt(goldRaw(), 10) || 0)
  const plan = () => (valid() ? calculateShardPlan(target()) : null)
  const comparison = () => (valid() ? compareStrategies(target(), heldGold()) : null)
  const dailyPlan = () =>
    valid() ? buildDailyPlan(target(), heldGold(), planStrategy()) : null

  const planRows = (): PlanRow[] => {
    const rows: PlanRow[] = []
    let lastDay = 0
    for (const action of dailyPlan()?.actions ?? []) {
      if (action.day !== lastDay) {
        lastDay = action.day
        rows.push({ kind: 'day', day: action.day })
      }
      rows.push({ kind: 'action', action })
    }
    return rows
  }

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
                onPlan={() => {
                  setPlanStrategy(strategy.id === 'vouchers' ? 'vouchers' : 'cheapest')
                  planDialog?.showModal()
                }}
              />
            )}
          </For>
        </div>

        <dialog
          ref={planDialog}
          aria-label="Day-by-day plan"
          onClick={(e) => {
            if (e.target === planDialog) planDialog?.close()
          }}
          class="m-auto w-[min(28rem,90vw)] rounded-xl border border-white/15 bg-zinc-950 p-0 text-white shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        >
          <div class="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 class="text-base font-semibold">
                {planStrategy() === 'cheapest' ? 'Cheapest Mix' : 'All Vouchers'}
              </h2>
              <p class="text-xs opacity-60">Day-by-day plan</p>
            </div>
            <button
              type="button"
              onClick={() => planDialog?.close()}
              aria-label="Close"
              class="rounded-md px-2 py-1 text-sm opacity-60 transition hover:opacity-100 hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <div class="max-h-[60vh] overflow-y-auto px-5 py-4">
            <For each={planRows()}>
              {(row) => (
                <Show when={row.kind === 'action'} fallback={<PlanHeader row={row} />}>
                  <PlanLine row={row} />
                </Show>
              )}
            </For>
          </div>

          <div class="flex flex-wrap gap-x-6 gap-y-1 border-t border-white/10 px-5 py-3 text-sm">
            <span>
              <span class="opacity-60">Total </span>
              <span class="font-semibold">{formatIdr.format(dailyPlan()!.totals.cost)}</span>
            </span>
            <span>
              <span class="opacity-60">Voucher packs </span>
              {formatNumber.format(dailyPlan()!.totals.packs)}
            </span>
            <span>
              <span class="opacity-60">Star gems </span>
              {formatNumber.format(dailyPlan()!.totals.gems)}
            </span>
            <Show when={dailyPlan()!.totals.goldLeft > 0}>
              <span>
                <span class="opacity-60">Gold left </span>
                {formatNumber.format(dailyPlan()!.totals.goldLeft)}
              </span>
            </Show>
          </div>
        </dialog>
      </Show>
    </div>
  )
}
