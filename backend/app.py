import os
import io
import gc
import logging

import numpy as np
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

ALLOWED_ORIGINS = [
    "https://remove-bg.gt.tc",
    "http://remove-bg.gt.tc",
    "http://localhost",
    "http://127.0.0.1",
]

CORS(app, resources={
    r"/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


# ---------------------------------------------------------------
# Load the rembg session ONCE at startup using u2netp (4MB model).
# We lazy-import rembg here so the module-level import doesn't
# consume memory before the session is ready.
# ---------------------------------------------------------------
os.environ["U2NET_HOME"] = "/opt/render/.u2net"

# Maximum image dimension — anything larger is downscaled before
# inference so peak RAM stays well below Render's 512 MB limit.
MAX_SIDE     = 800          # px  (was 1024 — reduced further)
FILE_LIMIT   = 4 * 1024 * 1024   # 4 MB hard reject

logger.info("Loading u2netp model …")
try:
    from rembg import remove, new_session
    SESSION = new_session("u2netp")
    logger.info("u2netp model loaded OK.")
except Exception as exc:
    logger.error(f"Model load failed: {exc}")
    SESSION = None
    remove  = None


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

def resize_if_needed(img: Image.Image) -> Image.Image:
    """Downscale so the longest side ≤ MAX_SIDE."""
    w, h = img.size
    if max(w, h) <= MAX_SIDE:
        return img
    ratio = MAX_SIDE / max(w, h)
    new_size = (int(w * ratio), int(h * ratio))
    logger.info(f"Resizing {w}x{h} → {new_size[0]}x{new_size[1]}")
    return img.resize(new_size, Image.LANCZOS)


def image_to_png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------
# Routes
# ---------------------------------------------------------------

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({
        "status": "running",
        "model": "u2netp",
        "model_loaded": SESSION is not None,
        "max_side_px": MAX_SIDE
    })


@app.route("/remove-bg", methods=["POST", "OPTIONS"])
def remove_background():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    if SESSION is None:
        return jsonify({"error": "Model not loaded. Please try again later."}), 503

    if "image" not in request.files:
        return jsonify({"error": "No image file in request (use key 'image')."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if file.content_type not in allowed_types:
        return jsonify({"error": f"Unsupported type: {file.content_type}"}), 400

    try:
        raw = file.read()
        if len(raw) > FILE_LIMIT:
            return jsonify({"error": "File too large. Max 4 MB."}), 413

        logger.info(f"Processing '{file.filename}' ({len(raw)//1024} KB)")

        # ── 1. Open & downscale ──────────────────────────────────
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        del raw
        gc.collect()

        img = resize_if_needed(img)

        # ── 2. Convert to PNG bytes for rembg ───────────────────
        png_bytes = image_to_png_bytes(img)
        img.close()
        del img
        gc.collect()

        # ── 3. Background removal ────────────────────────────────
        result_bytes = remove(png_bytes, session=SESSION)
        del png_bytes
        gc.collect()

        logger.info("Background removed successfully.")

        buf = io.BytesIO(result_bytes)
        del result_bytes
        gc.collect()

        return send_file(
            buf,
            mimetype="image/png",
            as_attachment=True,
            download_name="bg-removed.png"
        )

    except MemoryError:
        gc.collect()
        logger.error("OOM during processing.")
        return jsonify({"error": "Image too large to process. Please use a smaller image."}), 507

    except Exception as exc:
        gc.collect()
        logger.error(f"Processing error: {exc}")
        return jsonify({"error": "Failed to process image. Please try again."}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)