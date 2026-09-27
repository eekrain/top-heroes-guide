import { useState } from 'react'
import { calculateShardPlan } from '@/lib/shard-calculator'
import {
  compareStrategies,
  type StrategyResult,
} from '@/lib/daily-special-strategies'

const formatIdr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatNumber = new Intl.NumberFormat('id-ID')

const PRESETS = [40, 120, 200, 400]

function StrategyCard({
  strategy,
  cheapest,
}: {
  strategy: StrategyResult
  cheapest: boolean
}) {
  return (
    <div
      className={`rounded-lg border bg-fd-card p-4 ${
        cheapest ? 'border-fd-primary' : 'border-fd-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{strategy.label}</div>
        {cheapest && (
          <span className="rounded bg-fd-primary px-1.5 py-0.5 text-xs text-fd-primary-foreground">
            Cheapest
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold">
        {formatIdr.format(strategy.cost)}
      </div>
      <div className="mt-3 flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-fd-muted-foreground">Per shard</span>
          <span>{formatIdr.format(Math.round(strategy.costPerShard))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-fd-muted-foreground">Star gems</span>
          <span>{formatNumber.format(strategy.gems)}</span>
        </div>
        {strategy.packs > 0 && (
          <div className="flex justify-between">
            <span className="text-fd-muted-foreground">Packs</span>
            <span>{formatNumber.format(strategy.packs)}</span>
          </div>
        )}
        {strategy.bundleSpend > 0 && (
          <div className="flex justify-between">
            <span className="text-fd-muted-foreground">Bundles</span>
            <span>{formatIdr.format(strategy.bundleSpend)}</span>
          </div>
        )}
        {strategy.plainTopUp > 0 && (
          <div className="flex justify-between">
            <span className="text-fd-muted-foreground">Plain top-up</span>
            <span>{formatIdr.format(strategy.plainTopUp)}</span>
          </div>
        )}
        {strategy.goldSpent > 0 && (
          <div className="flex justify-between">
            <span className="text-fd-muted-foreground">Gold used</span>
            <span>{formatNumber.format(strategy.goldSpent)}</span>
          </div>
        )}
        {strategy.goldLeft > 0 && (
          <div className="flex justify-between">
            <span className="text-fd-muted-foreground">Gold left over</span>
            <span>{formatNumber.format(strategy.goldLeft)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function DailySpecialCalculator() {
  const [raw, setRaw] = useState('400')
  const [goldRaw, setGoldRaw] = useState('')
  const target = Number.parseInt(raw, 10)
  const valid = Number.isInteger(target) && target > 0
  const heldGold = Math.max(0, Number.parseInt(goldRaw, 10) || 0)
  const plan = valid ? calculateShardPlan(target) : null
  const comparison = valid ? compareStrategies(target, heldGold) : null

  return (
    <div className="flex flex-col gap-4 not-prose">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-fd-muted-foreground" htmlFor="shard-target">
          Target shards
        </label>
        <input
          id="shard-target"
          type="number"
          min={1}
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="w-32 rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-sm"
        />
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setRaw(String(preset))}
            className="rounded-md border border-fd-border px-2.5 py-1 text-xs hover:bg-fd-muted"
          >
            {formatNumber.format(preset)}
          </button>
        ))}
        <label className="ml-auto text-sm text-fd-muted-foreground" htmlFor="held-gold">
          Gold blocks you hold
        </label>
        <input
          id="held-gold"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="0"
          value={goldRaw}
          onChange={(e) => setGoldRaw(e.target.value)}
          className="w-36 rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-sm"
        />
      </div>

      {!comparison || !plan ? (
        <p className="text-sm text-fd-muted-foreground">
          Enter a positive number of shards.
        </p>
      ) : (
        <>
          <p className="text-sm text-fd-muted-foreground">
            {formatNumber.format(plan.actualShards)} shards over{' '}
            {formatNumber.format(plan.days)} {plan.days === 1 ? 'day' : 'days'}
            {plan.overshoot > 0 && (
              <span className="ml-2 rounded bg-fd-muted px-1.5 py-0.5 text-xs">
                +{formatNumber.format(plan.overshoot)} overshoot
              </span>
            )}
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {(
              [comparison.vouchers, comparison.cheapest] as StrategyResult[]
            ).map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                cheapest={comparison.cheapestId === strategy.id}
              />
            ))}
          </div>

          <div className="text-sm font-medium">Voucher plan schedule</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fd-border text-left text-fd-muted-foreground">
                <th className="py-2 font-medium">Days</th>
                <th className="py-2 font-medium">Vouchers</th>
                <th className="py-2 font-medium">Shards</th>
              </tr>
            </thead>
            <tbody>
              {plan.schedule.map((entry) => (
                <tr key={entry.fromDay} className="border-b border-fd-border">
                  <td className="py-2">
                    {entry.fromDay === entry.toDay
                      ? formatNumber.format(entry.fromDay)
                      : `${formatNumber.format(entry.fromDay)}–${formatNumber.format(entry.toDay)}`}
                  </td>
                  <td className="py-2">{formatNumber.format(entry.vouchers)}</td>
                  <td className="py-2">{formatNumber.format(entry.shards)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
