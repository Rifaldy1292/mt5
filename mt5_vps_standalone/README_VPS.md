# 🚀 MT5 VPS Standalone Bridge Server

Paket mandiri (**Zero-Config & Plug-and-Play**) untuk menjalankan MT5 API Bridge di **VPS Linux, VPS Windows, atau Docker**.

---

## 📁 Struktur Folder
```text
mt5_vps_standalone/
├── Dockerfile              # Dockerfile (Ubuntu + Wine + MT5 + Python)
├── docker-compose.yml      # 1-Command Start/Stop via Docker
├── api_server.py           # REST API Server (Port 5050, Remote 0.0.0.0, Auto-Sleep)
├── mt5_client.py           # MT5 Connection Manager & Auto-Discovery
├── history_parser.py       # Closed Trades & Cashflow Parser Engine
├── requirements.txt        # Python dependencies (MetaTrader5)
├── START_SERVER_LINUX.sh   # Auto-setup & Start untuk Linux VPS
├── STOP_SERVER_LINUX.sh    # Stop Server untuk Linux VPS
├── START_SERVER_WINDOWS.bat# One-click start untuk Windows VPS
├── STOP_SERVER_WINDOWS.bat # Stop Server untuk Windows VPS
└── README_VPS.md           # Panduan ini
```

---

## 🐳 Opsi 1: Menggunakan DOCKER *(Paling Rapi & Praktis)*

Jika VPS Anda sudah terpasang Docker & Docker Compose:

1. **Jalankan Server (Background)**:
   ```bash
   docker compose up -d --build
   ```
2. **Lihat Log Server**:
   ```bash
   docker compose logs -f
   ```
3. **Hentikan / Stop Server**:
   ```bash
   docker compose down
   ```

---

## 🐧 Opsi 2: Menggunakan Skrip Linux Biasa (Tanpa Docker)

1. **Jalankan Server (Auto-Install & Run)**:
   ```bash
   chmod +x START_SERVER_LINUX.sh STOP_SERVER_LINUX.sh
   ./START_SERVER_LINUX.sh
   ```
   *(Untuk running di background 24/7: `nohup ./START_SERVER_LINUX.sh > server.log 2>&1 &`)*

2. **Hentikan / Stop Server**:
   ```bash
   ./STOP_SERVER_LINUX.sh
   ```

---

## 🪟 Opsi 3: Di VPS Windows

1. **Start**: Double-click `START_SERVER_WINDOWS.bat`
2. **Stop**: Double-click `STOP_SERVER_WINDOWS.bat`

---

## 🔗 Menghubungkan Frontend Lokal ke VPS

Di PC lokal (laptop / PC kantor / Mac Anda):
Buka `jurnalTrading/svelte_adapters/apiClient.js` dan arahkan ke IP VPS Anda:

```javascript
export const defaultApiClient = new MT5ApiClient('http://IP_VPS_ANDA:5050');
```
Jalankan `npm run dev` di lokal dan seluruh data MT5 live dari VPS langsung terbaca!
