#!/usr/bin/env bash
# Render calls this as the Build Command.
# It installs dependencies AND pre-downloads the model so the
# worker process never has to download it during a live request.
set -e

pip install -r requirements.txt

echo "Pre-downloading u2netp model..."
python3 - << 'PYEOF'
import os
os.environ["U2NET_HOME"] = "/opt/render/.u2net"
from rembg import new_session
new_session("u2netp")
print("Model download complete.")
PYEOF