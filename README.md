# AI Background Remover - Deployment Guide

This project consists of two parts:
1.  **Frontend (HTML/CSS/JS):** A static website that handles the user interface and file selection.
2.  **Backend (Python/Flask):** An API that processes the image and removes the background using AI (`rembg`).

Since InfinityFree only supports PHP and not Python, you will host the **Frontend on InfinityFree** and the **Backend on Render or Railway**.

Here is a step-by-step guide to get everything live.

---

## Part 1: Test Locally (Optional but Recommended)

Before deploying, make sure it works on your computer.

1.  **Open Terminal / Command Prompt**
2.  **Navigate to the backend folder:**
    ```bash
    cd backend
    ```
3.  **Install the requirements:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Run the Flask app:**
    ```bash
    python app.py
    ```
    *The server will start at `http://localhost:5000`.*
5.  **Test the frontend:** Open `frontend/index.html` in your browser. Upload an image. It should process and return the result.

---

## Part 2: Deploy the Backend (Render or Railway)

We will use **Render** for this example, as it is very straightforward for Python Flask apps.

### Option A: Render (Recommended)

1.  Push this entire repository (or just the `backend` folder) to a new **GitHub repository**.
2.  Go to [Render.com](https://render.com/) and sign up / log in.
3.  Click **New +** and select **Web Service**.
4.  Connect your GitHub account and select your repository.
5.  Fill in the details:
    *   **Name:** `my-remove-bg-api` (or whatever you prefer)
    *   **Environment:** `Python 3`
    *   **Root Directory:** `backend` (if you uploaded the whole repo, otherwise leave blank if you only uploaded the backend files).
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `gunicorn app:app`
    *   **Instance Type:** Free
6.  Click **Create Web Service**.
7.  Wait for the deployment to finish (this might take a few minutes as it downloads the AI models).
8.  Once deployed, copy your new backend URL (e.g., `https://my-remove-bg-api.onrender.com`).

---

## Part 3: Update the Frontend Code

Now that your backend is live, you need to tell your frontend where to send the images.

1.  Open the `frontend/script.js` file in a text editor.
2.  Find this line (around line 23):
    ```javascript
    const API_URL = 'http://localhost:5000/remove-bg'; 
    ```
3.  **Change it to your new live backend URL**, making sure to keep `/remove-bg` at the end. For example:
    ```javascript
    const API_URL = 'https://my-remove-bg-api.onrender.com/remove-bg'; 
    ```
4.  Save the file.

---

## Part 4: Deploy the Frontend (InfinityFree)

1.  Go to [InfinityFree](https://infinityfree.net/) and log in to your account.
2.  Open the **Control Panel** for your domain.
3.  Click on **Online File Manager** (htdocs).
4.  Open the `htdocs` folder. This is where your website files go.
5.  **Delete any default files** in there (like `index2.html` or default InfinityFree pages).
6.  **Upload the contents** of your `frontend` folder:
    *   `index.html`
    *   `style.css`
    *   `script.js` (Make sure this is the one you updated with the live backend URL!)
7.  Once the upload is complete, visit your InfinityFree domain in your web browser.

**Congratulations! Your AI Background Removal site is now live!**

---

### Troubleshooting

*   **CORS Error in Browser Console:** If the frontend fails to upload and you see a "CORS" error in the browser's developer tools (F12), ensure your backend is correctly running and that you didn't miss the `CORS(app)` line in `backend/app.py`.
*   **Request Timeout / 502 Bad Gateway:** Free tiers on Render/Railway might spin down when not in use. The first request after a while might take 30-50 seconds as the server wakes up and loads the AI model. Subsequent requests will be much faster.
