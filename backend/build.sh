#!/usr/bin/env bash
# Render Build Command: chmod +x build.sh && ./build.sh
# NOT used locally — run "pip install -r requirements.txt" locally instead.
set -e
pip install -r requirements.txt

echo "==> Pre-downloading u2netp model into /opt/render/.u2net …"
python3 - << 'PYEOF'
import os
os.environ["U2NET_HOME"] = "/opt/render/.u2net"
from rembg import new_session
new_session("u2netp")
print("==> Model cached OK.")
PYEOF