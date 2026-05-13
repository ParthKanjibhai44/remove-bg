#!/usr/bin/env bash
set -e

pip install -r requirements.txt

echo "==> Pre-downloading u2netp model at build time..."
python3 - << 'PYEOF'
import os
os.environ["U2NET_HOME"] = "/opt/render/.u2net"
from rembg import new_session
new_session("u2netp")
print("==> Model cached successfully.")
PYEOF