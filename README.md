# 📓 Standalone MT5 Trading Journal & Analytics Core

Modul mandiri dan terisolasi untuk fitur **Jurnal Trading berbasis MetaTrader 5 (MT5)**. Modul ini dirancang khusus agar mudah dipelajari, dijalankan, dan langsung di-copy/porting ke aplikasi frontend modern seperti **Svelte / SvelteKit**.

---

## 📁 Struktur Direktori

```text
jurnalTrading/
├── README.md                      # Dokumentasi umum arsitektur & API
├── SVELTE_PORTING_GUIDE.md        # Tutorial porting ke Svelte / SvelteKit
├── requirements.txt               # Dependensi Python minimal (MetaTrader5)
├── package.json                   # Konfigurasi npm
│
├── python_bridge/                 # Python MT5 Extractor Engine
│   ├── mt5_client.py              # Koneksi MT5, auto-detect terminal, authentication
│   ├── history_parser.py          # Parsing deals -> Closed trades, positions, cashflows
│   └── api_server.py              # REST API server (port 5050)
│
├── journal_core/                  # Business Logic & Mathematical Engine (JS / TS)
│   ├── index.js                   # Consolidated export
│   ├── analytics.js               # Winrate, Profit Factor, Drawdown, Expectancy, Streaks
│   ├── trader_dna.js              # Analisis perilaku Trader DNA (Radar dimensions & behavioral flags)
│   ├── equity_curve.js            # Generator data deret waktu untuk grafik dan laporan bulanan
│   ├── normalizer.js              # Sanitasi & standardisasi data trade
│   └── types.d.ts                 # Definisi TypeScript lengkap
│
├── svelte_adapters/               # Adapter Siap Pakai untuk Svelte
│   ├── apiClient.js               # Client fetcher ke API bridge Python
│   ├── mt5Store.js                # Svelte reactive store untuk koneksi MT5 & auto-polling
│   ├── journalStore.js            # Svelte reactive store untuk data transaksi & analitik
│   └── mockData.json              # Data simulasi lengkap untuk preview UI tanpa MT5
│
└── examples/
    └── test_standalone_flow.js    # Skrip pengujian end-to-end kalkulasi
```

---

## ⚡ Cara Menjalankan

### 1. Uji Kalkulasi Jurnal (Tanpa Membutuhkan MT5 Langsung)
Jalankan skrip tes untuk melihat kalkulasi Winrate, Drawdown, Profit Factor, dan Trader DNA:
```bash
node examples/test_standalone_flow.js
```

### 2. Jalankan Python MT5 Bridge Server
Pastikan dependensi Python sudah terpasang:
```bash
pip install -r requirements.txt
python python_bridge/api_server.py
```
Server akan berjalan di `http://127.0.0.1:5050`.

---

## 🔌 API Endpoint Python Bridge

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/health` | Cek status server bridge & library MT5 |
| `POST` | `/api/mt5/login` | Login & inisialisasi MT5 (`{ login, password, server, terminalPath? }`) |
| `GET` | `/api/mt5/snapshot` | Mengambil saldo, floating profit, dan posisi terbuka saat ini |
| `GET` | `/api/mt5/history?days=60` | Mengambil histori closed trades dan deposit/penarikan |
| `POST` | `/api/mt5/disconnect` | Memutus koneksi MT5 secara bersih |

---

## 🚀 Porting ke Svelte / SvelteKit
Lihat panduan lengkap beserta contoh komponen UI Svelte di file **[`SVELTE_PORTING_GUIDE.md`](./SVELTE_PORTING_GUIDE.md)**.
