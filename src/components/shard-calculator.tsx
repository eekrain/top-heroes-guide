import { useState } from 'react'
import { calculateShardPlan } from '@/lib/shard-calculator'

const formatIdr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatNumber = new Intl.NumberFormat('id-ID')

const PRESETS = [40, 120, 200, 400]

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-fd-border bg-fd-card p-4">
      <div className="text-sm text-fd-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

export function ShardCalculator() {
  const [raw, setRaw] = useState('400')
  const target = Number.parseInt(raw, 10)
  const valid = Number.isInteger(target) && target > 0
  const plan = valid ? calculateShardPlan(target) : null

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
      </div>

      {!plan ? (
        <p className="text-sm text-fd-muted-foreground">
          Enter a positive number of shards.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total cost" value={formatIdr.format(plan.cost)} />
            <StatCard label="Days" value={formatNumber.format(plan.days)} />
            <StatCard label="Packs" value={formatNumber.format(plan.packs)} />
            <StatCard
              label="Cost per shard"
              value={formatIdr.format(Math.round(plan.costPerShard))}
            />
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between border-b border-fd-border py-1.5">
              <span className="text-fd-muted-foreground">Shards</span>
              <span>
                {formatNumber.format(plan.actualShards)}
                {plan.overshoot > 0 && (
                  <span className="ml-2 rounded bg-fd-muted px-1.5 py-0.5 text-xs">
                    +{formatNumber.format(plan.overshoot)} overshoot
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between border-b border-fd-border py-1.5">
              <span className="text-fd-muted-foreground">Vouchers used</span>
              <span>{formatNumber.format(plan.totalVouchers)}</span>
            </div>
            <div className="flex justify-between border-b border-fd-border py-1.5">
              <span className="text-fd-muted-foreground">Leftover vouchers (carry over)</span>
              <span>{formatNumber.format(plan.leftoverVouchers)}</span>
            </div>
          </div>

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
