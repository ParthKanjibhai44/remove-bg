from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from rembg import remove, new_session
from PIL import Image
import io

app = Flask(__name__)
# Enable CORS for all domains so the InfinityFree frontend can access the API.
CORS(app)

# Initialize the 'u2netp' model globally so it downloads and loads into memory 
# when the server starts, rather than during the first request.
# 'u2netp' is a smaller model (~4MB) that prevents Out-Of-Memory errors on Render's free tier.
session = new_session("u2netp")

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({'status': 'Background Removal API is running'})

@app.route('/remove-bg', methods=['POST'])
def remove_background():
    if 'image' not in request.files:
        return jsonify({'error': 'No image part in the request'}), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({'error': 'No selected image'}), 400
    
    try:
        # Read the image file
        input_image = file.read()
        
        # Process the image with rembg using the lightweight session
        output_image = remove(input_image, session=session)
        
        # Return the processed image as a response
        return send_file(
            io.BytesIO(output_image),
            mimetype='image/png',
            as_attachment=True,
            download_name='bg-removed.png'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # In production on Render/Railway, gunicorn is used and it sets its own host/port.
    # For local development, this will run on localhost:5000.
    app.run(host='0.0.0.0', port=5000, debug=True)
