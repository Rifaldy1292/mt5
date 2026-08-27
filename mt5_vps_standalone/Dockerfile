# TradeRoom MT5 Bridge - 10-Slot Dynamic Gateway Edition (Ubuntu + Wine + MT5 Pool + Python)
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV WINEDEBUG=-all
ENV WINEARCH=win64
ENV WINEPREFIX=/root/.wine
ENV WINEDLLOVERRIDES="mscoree,mshtml="

# 1. Install prerequisites, Xvfb & Wine
RUN dpkg --add-architecture i386 && \
    apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    gnupg2 \
    software-properties-common \
    ca-certificates \
    cabextract \
    xvfb \
    wine \
    wine64 \
    wine32 && \
    (which wine || ln -s /usr/bin/wine64 /usr/bin/wine) && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Copy application files & local MT5 installer
COPY requirements.txt .
COPY mt5setup.exe .
COPY api_server.py .
COPY worker_instance.py .
COPY mt5_client.py .
COPY history_parser.py .

# 3. Setup Wine Virtual Display, Install Python Windows & MT5
RUN Xvfb :99 -screen 0 1024x768x16 & \
    export DISPLAY=:99 && \
    wineboot --init && \
    wineserver -w && \
    wget -q https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe && \
    wine python-3.11.9-amd64.exe /quiet InstallAllUsers=1 TargetDir="C:\\Python311" PrependPath=1 Include_pip=1 && \
    wineserver -w && \
    rm -f python-3.11.9-amd64.exe && \
    (wine mt5setup.exe /auto || true) && \
    wineserver -w && \
    wine "C:\\Python311\\python.exe" -m pip install --upgrade pip && \
    wine "C:\\Python311\\python.exe" -m pip install -r requirements.txt && \
    mkdir -p "/root/.wine/drive_c/MT5_Terminals" && \
    for i in $(seq 1 10); do \
        if [ -d "/root/.wine/drive_c/Program Files/MetaTrader 5" ]; then \
            cp -r "/root/.wine/drive_c/Program Files/MetaTrader 5" "/root/.wine/drive_c/MT5_Terminals/term_$i"; \
        fi \
    done

# 4. Create convenient wrapper for wine python
RUN echo '#!/bin/bash\nwine "C:\\\\Python311\\\\python.exe" "$@"' > /usr/local/bin/wine-python && \
    chmod +x /usr/local/bin/wine-python

EXPOSE 5050

# 5. Start Virtual Screen & MT5 Dynamic Master Gateway (Port 5050)
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x16 & export DISPLAY=:99 && wine \"C:\\Python311\\python.exe\" api_server.py"]
