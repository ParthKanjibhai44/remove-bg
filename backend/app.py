import os
import io
import gc
import logging

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from rembg import remove, new_session
from PIL import Image

# Configure logging so all messages appear in Render logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ---------------------------------------------------------------
# CORS
# ---------------------------------------------------------------
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
# Model config
# u2netp = ~4MB model, lightest available in rembg.
# MAX_SIDE caps the image resolution before inference to
# keep peak RAM well under Render's 512MB limit.
# ---------------------------------------------------------------
os.environ["U2NET_HOME"] = "/opt/render/.u2net"
MAX_SIDE = 1024   # pixels — resize any image larger than this before processing
FILE_SIZE_LIMIT = 5 * 1024 * 1024  # 5 MB

logger.info("Loading u2netp model at startup...")
try:
    session = new_session("u2netp")
    logger.info("u2netp model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    session = None


# ---------------------------------------------------------------
# Helper: resize image so its longest side <= MAX_SIDE,
# then return as PNG bytes. This is the key memory-saving step.
# ---------------------------------------------------------------
def preprocess_image(input_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
    w, h = img.size
    if max(w, h) > MAX_SIDE:
        ratio = MAX_SIDE / max(w, h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        logger.info(f"Resized image from {w}x{h} to {new_w}x{new_h} to save memory.")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img.close()
    return buf.getvalue()


# ---------------------------------------------------------------
# Routes
# ---------------------------------------------------------------

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({
        "status": "running",
        "model": "u2netp",
        "model_loaded": session is not None,
        "max_side_px": MAX_SIDE
    })


@app.route("/remove-bg", methods=["POST", "OPTIONS"])
def remove_background():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.status_code = 200
        return response

    if session is None:
        logger.error("Model session is not initialized.")
        return jsonify({"error": "Model not loaded. Please try again later."}), 503

    if "image" not in request.files:
        return jsonify({"error": "No image found in request. Use key name 'image'."}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if file.content_type not in allowed_types:
        return jsonify({"error": f"Unsupported file type: {file.content_type}"}), 400

    try:
        logger.info(f"Processing image: {file.filename}")

        input_bytes = file.read()

        if len(input_bytes) > FILE_SIZE_LIMIT:
            return jsonify({"error": "File too large. Maximum size is 5MB."}), 413

        # Key step: shrink large images before inference to stay within 512MB RAM
        processed_bytes = preprocess_image(input_bytes)
        del input_bytes   # free original bytes immediately
        gc.collect()

        # Remove background
        output_bytes = remove(processed_bytes, session=session)
        del processed_bytes
        gc.collect()

        logger.info("Background removed successfully.")

        result = io.BytesIO(output_bytes)
        del output_bytes
        gc.collect()

        return send_file(
            result,
            mimetype="image/png",
            as_attachment=True,
            download_name="bg-removed.png"
        )

    except MemoryError:
        gc.collect()
        logger.error("OOM during image processing.")
        return jsonify({"error": "Image too complex to process. Try a smaller image."}), 507

    except Exception as e:
        gc.collect()
        logger.error(f"Error processing image: {e}")
        return jsonify({"error": "Failed to process image. Please try again."}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)