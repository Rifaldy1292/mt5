# 🚀 Panduan Porting ke Svelte / SvelteKit

Panduan ini menjelaskan cara memindahkan folder `jurnalTrading` ke dalam project **Svelte** atau **SvelteKit** baru.

---

## 1. Salin Folder ke Project SvelteKit

Di dalam project SvelteKit Anda (`src/lib/`):

```text
src/
└── lib/
    ├── journal/
    │   ├── core/                  <- copy dari jurnalTrading/journal_core/
    │   ├── stores/
    │   │   ├── journalStore.js    <- copy dari jurnalTrading/svelte_adapters/journalStore.js
    │   │   └── mt5Store.js        <- copy dari jurnalTrading/svelte_adapters/mt5Store.js
    │   ├── apiClient.js           <- copy dari jurnalTrading/svelte_adapters/apiClient.js
    │   └── mockData.json          <- copy dari jurnalTrading/svelte_adapters/mockData.json
    └── components/
        ├── JournalStats.svelte
        ├── TraderDnaCard.svelte
        ├── EquityChart.svelte
        └── TradeTable.svelte
```

---

## 2. Contoh Komponen Svelte: Overview & Metrik Jurnal

Buat file `src/lib/components/JournalStats.svelte`:

```svelte
<script>
  import { journal } from '$lib/journal/stores/journalStore.js';
  const { analytics, profile } = journal;
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
  <!-- Net Profit -->
  <div class="card bg-zinc-900 border border-zinc-800 rounded-xl p-4">
    <span class="text-xs text-zinc-400">Net Realized P&L</span>
    <h3 class="text-2xl font-bold {$analytics.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
      {$analytics.netPnl >= 0 ? '+' : ''}${$analytics.netPnl.toLocaleString()}
    </h3>
    <span class="text-xs text-zinc-500">Gross: ${$analytics.grossProfit}</span>
  </div>

  <!-- Win Rate -->
  <div class="card bg-zinc-900 border border-zinc-800 rounded-xl p-4">
    <span class="text-xs text-zinc-400">Win Rate</span>
    <h3 class="text-2xl font-bold text-zinc-100">{$analytics.winRate}%</h3>
    <span class="text-xs text-zinc-500">{$analytics.wins}W / {$analytics.losses}L</span>
  </div>

  <!-- Profit Factor -->
  <div class="card bg-zinc-900 border border-zinc-800 rounded-xl p-4">
    <span class="text-xs text-zinc-400">Profit Factor</span>
    <h3 class="text-2xl font-bold text-cyan-400">{$analytics.profitFactor}</h3>
    <span class="text-xs text-zinc-500">Avg R: {$analytics.avgR}R</span>
  </div>

  <!-- Max Drawdown -->
  <div class="card bg-zinc-900 border border-zinc-800 rounded-xl p-4">
    <span class="text-xs text-zinc-400">Max Drawdown</span>
    <h3 class="text-2xl font-bold text-amber-400">{$analytics.maxDrawdownPct}%</h3>
    <span class="text-xs text-zinc-500">-${$analytics.maxDrawdownAmount}</span>
  </div>
</div>
```

---

## 3. Contoh Komponen Svelte: Trader DNA Card

Buat file `src/lib/components/TraderDnaCard.svelte`:

```svelte
<script>
  import { journal } from '$lib/journal/stores/journalStore.js';
  const { traderDna } = journal;
</script>

<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
  <div class="flex items-center justify-between mb-4">
    <div>
      <h2 class="text-lg font-semibold text-zinc-100">Trader DNA Assessment</h2>
      <p class="text-xs text-zinc-400">Analisis kedisiplinan dan psikologi trading otomatis</p>
    </div>
    <div class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-sm">
      Grade {$traderDna.grade} ({$traderDna.overall}/100)
    </div>
  </div>

  <!-- Dimension Bars -->
  <div class="space-y-3 mb-6">
    {#each Object.entries($traderDna.dimensions) as [dim, score]}
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="capitalize text-zinc-300">{dim}</span>
          <span class="font-medium text-zinc-400">{score}/100</span>
        </div>
        <div class="w-full bg-zinc-800 rounded-full h-2">
          <div class="bg-emerald-400 h-2 rounded-full transition-all" style="width: {score}%"></div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Qualitative Findings -->
  <div class="space-y-2">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Evaluasi & Risiko</h4>
    {#each $traderDna.findings as item}
      <div class="p-3 rounded-lg border text-xs {item.level === 'risk' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : item.level === 'warn' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}">
        <strong class="block mb-1">{item.title}</strong>
        <p class="opacity-90">{item.detail}</p>
      </div>
    {/each}
  </div>
</div>
```

---

## 4. Contoh Komponen Svelte: Tabel Transaksi dengan Filter

Buat file `src/lib/components/TradeTable.svelte`:

```svelte
<script>
  import { journal } from '$lib/journal/stores/journalStore.js';
  const { filteredTrades, filters, exportCSV } = journal;

  function downloadCSV() {
    const csv = exportCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading_journal_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }
</script>

<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
  <div class="flex justify-between items-center mb-4">
    <input
      type="text"
      placeholder="Cari simbol, setup, atau catatan..."
      bind:value={$filters.searchQuery}
      class="bg-zinc-800 text-zinc-200 text-sm px-3 py-2 rounded-lg border border-zinc-700 w-72 focus:outline-none focus:border-emerald-500"
    />
    <button
      on:click={downloadCSV}
      class="px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700"
    >
      📥 Export CSV
    </button>
  </div>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-xs text-zinc-300">
      <thead class="bg-zinc-800/60 uppercase text-zinc-400 text-[10px]">
        <tr>
          <th class="p-3">Simbol</th>
          <th class="p-3">Side</th>
          <th class="p-3">Entry / Exit</th>
          <th class="p-3">Lot</th>
          <th class="p-3">Net P&L</th>
          <th class="p-3">R:R</th>
          <th class="p-3">Close Reason</th>
          <th class="p-3">Setup</th>
          <th class="p-3">Waktu Tutup</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-800">
        {#each $filteredTrades as t}
          <tr class="hover:bg-zinc-800/40">
            <td class="p-3 font-semibold text-zinc-100">{t.symbol}</td>
            <td class="p-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold {t.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                {t.side}
              </span>
            </td>
            <td class="p-3">{t.entry} → {t.exit}</td>
            <td class="p-3">{t.lots}</td>
            <td class="p-3 font-bold {t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
              {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
            </td>
            <td class="p-3">{t.rMultiple}R</td>
            <td class="p-3 text-zinc-400">{t.closeReason}</td>
            <td class="p-3 text-zinc-400">{t.setup}</td>
            <td class="p-3 text-zinc-500">{new Date(t.closedAt).toLocaleDateString()}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
```
