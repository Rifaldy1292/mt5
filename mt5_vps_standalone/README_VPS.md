# 🚀 MT5 VPS Standalone Dynamic Gateway (10-Slot Multi-Terminal Pool)

Paket mandiri (**Zero-Config & Plug-and-Play**) untuk menjalankan MT5 Dynamic Gateway di **Docker, VPS Linux, atau VPS Windows**.

---

## ✨ Fitur Utama
1. **10-Slot Dynamic Dispatcher (1 Container Saja)**:
   Menjalankan 10 terminal MT5 portable terisolasi (`Slot 1` s/d `Slot 10`) dalam 1 container.
2. **Auto-Shift (< 10 Detik)**:
   Jika Slot 1 sedang dipakai/aktif (< 10 detik), request akun baru otomatis dialihkan ke Slot 2, Slot 3, dst.
3. **Backend Credentials Cache**:
   Password disimpan aman di memori backend setelah user login, sehingga frontend tidak perlu mengirim password berulang kali. Sesi cache tetap aktif hingga user melakukan logout/disconnect.
4. **Auto-Reconnection**:
   Jika sesi MT5 tertimpa atau idle, backend otomatis login ulang di background menggunakan password dari cache saat ada permintaan snapshot / history.
5. **Unified Port 5050**:
   Frontend cukup mengakses 1 endpoint utama di port `5050`.

---

## 📁 Struktur Folder
```text
mt5_vps_standalone/
├── Dockerfile              # Dockerfile (Ubuntu + Wine + MT5 Pool 10 Slot + Python)
├── docker-compose.yml      # Single-service Docker Compose (Port 5050)
├── api_server.py           # Master Gateway & 10-Slot Dynamic Dispatcher (Port 5050)
├── worker_instance.py      # Micro-Worker per Terminal (Port 5101..5110)
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

## 🐳 Cara Menjalankan via DOCKER

1. **Jalankan Container (Build & Start)**:
   ```bash
   sudo docker compose up -d --build
   ```
2. **Lihat Log Server**:
   ```bash
   sudo docker compose logs -f
   ```
3. **Cek Status Kesehatan Gateway & 10 Slot**:
   ```bash
   curl http://localhost:5050/health
   ```
4. **Hentikan Container**:
   ```bash
   sudo docker compose down
   ```

---

## 🔌 Dokumentasi Endpoint API

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/health` | Cek status gateway, daftar 10 slot (idle/busy), dan akun ter-cache |
| `POST` | `/api/mt5/login` | Login akun broker (`{ login, password, server }`), simpan cache, bind ke slot |
| `GET` | `/api/mt5/snapshot` | Ambil snapshot equity/balance & open trades (`?account=12345` opsional) |
| `GET` | `/api/mt5/history?days=60` | Ambil riwayat trading & cashflow (`?account=12345&days=60`) |
| `POST` | `/api/mt5/disconnect` | Logout akun, hapus password dari cache, dan bebaskan slot |
| `GET` | `/api/mt5/accounts` | Daftar seluruh akun yang sedang login / tersimpan di cache |
