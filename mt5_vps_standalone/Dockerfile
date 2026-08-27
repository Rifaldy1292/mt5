# TradeRoom MT5 Bridge - Docker Edition (Ubuntu + Wine + MT5 + Python)
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV WINEDEBUG=-all
ENV WINEPREFIX=/root/.wine

# 1. Install prerequisites & Wine
RUN dpkg --add-architecture i386 && \
    apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    gnupg2 \
    software-properties-common \
    ca-certificates \
    cabextract \
    xvfb \
    wine64 \
    wine32 && \
    rm -rf /var/lib/apt/lists/*

# 2. Setup Wine environment
RUN wineboot --init || true

WORKDIR /app

# 3. Copy application files
COPY requirements.txt .
COPY api_server.py .
COPY mt5_client.py .
COPY history_parser.py .

# 4. Download & install Python Windows inside Wine & MT5
RUN wget -q https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe && \
    wine python-3.11.9-amd64.exe /quiet InstallAllUsers=1 PrependPath=1 && \
    rm -f python-3.11.9-amd64.exe && \
    wget -q https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5ubuntu.sh && \
    chmod +x mt5ubuntu.sh && \
    ./mt5ubuntu.sh || true && \
    wine python -m pip install --upgrade pip && \
    wine python -m pip install -r requirements.txt

EXPOSE 5050

# 5. Start XVFB (Virtual Display) & MT5 Bridge API
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x16 & export DISPLAY=:99 && wine python api_server.py"]
