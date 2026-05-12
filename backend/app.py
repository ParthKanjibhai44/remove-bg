import os
import io
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
# CORS — allow only your InfinityFree domain.
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


# ---------------------------------------------------------------
# Safety net: manually attach CORS headers to EVERY response,
# including Flask error handlers (400, 413, 500, 503).
# Flask-CORS alone won't cover responses raised before routing.
# ---------------------------------------------------------------
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


# ---------------------------------------------------------------
# Pre-download and load the model ONCE at startup.
# u2netp is ~4MB — safe for Render free 512MB RAM.
# ---------------------------------------------------------------
os.environ["U2NET_HOME"] = "/opt/render/.u2net"

logger.info("Loading u2netp model at startup...")
try:
    session = new_session("u2netp")
    logger.info("u2netp model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    session = None


# ---------------------------------------------------------------
# Routes
# ---------------------------------------------------------------

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({
        "status": "running",
        "model": "u2netp",
        "model_loaded": session is not None
    })


@app.route("/remove-bg", methods=["POST", "OPTIONS"])
def remove_background():
    # Handle preflight OPTIONS request from browser
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

    # Validate file is an image
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if file.content_type not in allowed_types:
        return jsonify({"error": f"Unsupported file type: {file.content_type}"}), 400

    try:
        logger.info(f"Processing image: {file.filename}")

        input_bytes = file.read()

        # Safety check — reject files over 5MB to protect RAM
        if len(input_bytes) > 5 * 1024 * 1024:
            return jsonify({"error": "File too large. Maximum size is 5MB."}), 413

        # Remove background using the preloaded session
        output_bytes = remove(input_bytes, session=session)

        logger.info("Background removed successfully.")

        return send_file(
            io.BytesIO(output_bytes),
            mimetype="image/png",
            as_attachment=True,
            download_name="bg-removed.png"
        )

    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return jsonify({"error": "Failed to process image. Please try again."}), 500


# ---------------------------------------------------------------
# Only used for local development.
# On Render, gunicorn is used via Start Command.
# ---------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)