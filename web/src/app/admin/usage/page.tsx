'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui';

interface DailyRow {
  date: string;
  feature: string;
  model: string;
  calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd_cents: number;
}

interface UsageResponse {
  daily: DailyRow[];
  totals: {
    today_cents: number;
    last_7d_cents: number;
    last_30d_cents: number;
  };
  window_days: number;
}

function fmtUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/usage?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((json: UsageResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error) return <div className="p-6 text-red-500">Erreur : {error}</div>;
  if (!data) return <div className="p-6">Chargement…</div>;

  // Build a date-indexed totals map for the chart
  const byDate = new Map<string, number>();
  for (const row of data.daily) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.total_cost_usd_cents);
  }
  const sortedDates = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxCents = Math.max(1, ...sortedDates.map(([, c]) => c));

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Coût LLM</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Aujourd&apos;hui</p>
          <p className="text-3xl font-bold">{fmtUSD(data.totals.today_cents)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">7 derniers jours</p>
          <p className="text-3xl font-bold">{fmtUSD(data.totals.last_7d_cents)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">30 derniers jours</p>
          <p className="text-3xl font-bold">{fmtUSD(data.totals.last_30d_cents)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Coût par jour</h2>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm bg-transparent border rounded px-2 py-1"
          >
            <option value={7}>7j</option>
            <option value={14}>14j</option>
            <option value={30}>30j</option>
            <option value={90}>90j</option>
          </select>
        </div>
        {sortedDates.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune utilisation enregistrée sur la période.</p>
        ) : (
          <div className="space-y-1">
            {sortedDates.map(([date, cents]) => (
              <div key={date} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-muted-foreground tabular-nums">{date}</span>
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded h-5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-400"
                    style={{ width: `${(cents / maxCents) * 100}%` }}
                  />
                </div>
                <span className="w-20 text-right font-mono tabular-nums">{fmtUSD(cents)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Détail par feature / modèle</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Feature</th>
                <th className="py-2 pr-4">Modèle</th>
                <th className="py-2 pr-4 text-right">Appels</th>
                <th className="py-2 pr-4 text-right">In tokens</th>
                <th className="py-2 pr-4 text-right">Out tokens</th>
                <th className="py-2 text-right">Coût</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((row, i) => (
                <tr key={`${row.date}-${row.feature}-${row.model}-${i}`} className="border-b border-border/50">
                  <td className="py-2 pr-4 tabular-nums">{row.date}</td>
                  <td className="py-2 pr-4">{row.feature}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.model}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.calls}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.total_input_tokens.toLocaleString('fr-FR')}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.total_output_tokens.toLocaleString('fr-FR')}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{fmtUSD(row.total_cost_usd_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
