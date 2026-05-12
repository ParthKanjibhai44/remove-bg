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
# Replace the URL below with your actual InfinityFree domain.
# ---------------------------------------------------------------
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://remove-bg.gt.tc",   # <-- your InfinityFree domain
            "http://remove-bg.gt.tc",    # keep both http and https
            "http://localhost",          # for local testing
            "http://127.0.0.1"           # for local testing
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# ---------------------------------------------------------------
# Pre-download and load the model ONCE at startup.
# u2netp is ~4MB (not 176MB) — safe for Render free 512MB RAM.
# Setting the env variable stops rembg from ever trying u2net.
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
        return jsonify({"status": "ok"}), 200

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