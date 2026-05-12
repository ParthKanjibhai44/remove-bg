document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadBox = document.getElementById('uploadBox');
    const imageInput = document.getElementById('imageInput');
    const uploadContent = document.getElementById('uploadContent');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const changeImageBtn = document.getElementById('changeImageBtn');
    const removeBgBtn = document.getElementById('removeBgBtn');
    const loadingState = document.getElementById('loadingState');
    const loadingText = document.getElementById('loadingText');
    const resultSection = document.getElementById('resultSection');
    const resultImage = document.getElementById('resultImage');
    const downloadBtn = document.getElementById('downloadBtn');
    const startOverBtn = document.getElementById('startOverBtn');
    const errorToast = document.getElementById('errorToast');
    const errorMessage = document.getElementById('errorMessage');

    let selectedFile = null;

    // === CONFIGURATION ===
    const BASE_URL = 'https://remove-bg-nwl7.onrender.com';
    const API_URL = `${BASE_URL}/remove-bg`;

    // ---------------------------------------------------------------
    // Wake up the Render server as soon as the page loads.
    // Render free tier spins down after ~15 min of inactivity.
    // Pinging the health check endpoint early cuts cold-start delay.
    // ---------------------------------------------------------------
    function pingServer() {
        fetch(`${BASE_URL}/`, { method: 'GET', mode: 'cors' })
            .then(() => console.log('Server is awake.'))
            .catch(() => console.log('Server ping failed (may still be waking up).'));
    }
    pingServer();

    // Event Listeners for Upload Box
    uploadBox.addEventListener('click', (e) => {
        if (e.target !== changeImageBtn) {
            imageInput.click();
        }
    });

    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    changeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imageInput.click();
    });

    // Handle File Selection
    function handleFile(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showError('Please select a valid image file (JPG, PNG, WEBP).');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showError('Image size should be less than 5MB.');
            return;
        }

        selectedFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            uploadContent.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            removeBgBtn.disabled = false;
            removeBgBtn.classList.remove('disabled');
        };
        reader.readAsDataURL(file);
    }

    // ---------------------------------------------------------------
    // fetchWithRetry — retries on 502/503 (Render cold start).
    // Waits 3 seconds between attempts and updates the loading text
    // so the user knows what is happening.
    // ---------------------------------------------------------------
    async function fetchWithRetry(url, options, maxRetries = 3, delayMs = 3000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    setLoadingText(`Server is waking up... (attempt ${attempt}/${maxRetries})`);
                    await new Promise(res => setTimeout(res, delayMs));
                }

                const response = await fetch(url, options);

                // 502/503 = server not ready yet, retry
                if ((response.status === 502 || response.status === 503) && attempt < maxRetries) {
                    console.warn(`Attempt ${attempt} got ${response.status}, retrying...`);
                    continue;
                }

                return response; // success or final attempt
            } catch (networkError) {
                // Hard network failure (CORS from 502, ERR_FAILED, etc.)
                if (attempt === maxRetries) throw networkError;
                console.warn(`Attempt ${attempt} network error, retrying...`, networkError);
            }
        }
    }

    function setLoadingText(text) {
        if (loadingText) loadingText.textContent = text;
    }

    // Handle API Request
    removeBgBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // UI State: Loading
        previewContainer.classList.add('hidden');
        loadingState.classList.remove('hidden');
        uploadBox.style.pointerEvents = 'none';
        removeBgBtn.disabled = true;
        removeBgBtn.classList.add('disabled');
        resultSection.classList.add('hidden');
        setLoadingText('Removing background...');

        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            const response = await fetchWithRetry(API_URL, {
                method: 'POST',
                body: formData,
                // Do NOT set Content-Type — browser sets it automatically with multipart boundary
            });

            if (!response.ok) {
                // Try to parse a JSON error body; fall back to a generic message
                let errMsg = 'Failed to process image. Please try again.';
                try {
                    const errorData = await response.json();
                    if (errorData.error) errMsg = errorData.error;
                } catch (_) { /* response was not JSON */ }
                throw new Error(errMsg);
            }

            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            resultImage.src = imageUrl;
            downloadBtn.href = imageUrl;

            // Append _nobg to the original filename
            const originalName = selectedFile.name;
            const dotIndex = originalName.lastIndexOf('.');
            const nameWithoutExt = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
            downloadBtn.download = `${nameWithoutExt}_nobg.png`;

            // UI State: Result
            loadingState.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            uploadBox.style.pointerEvents = 'auto';
            resultSection.classList.remove('hidden');

            setTimeout(() => {
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);

        } catch (error) {
            console.error('Error:', error);

            // Friendlier message for raw network/CORS failures
            const msg = error.message && error.message !== 'Failed to fetch'
                ? error.message
                : 'Could not reach the server. It may still be waking up — please wait 30 seconds and try again.';
            showError(msg);

            // Reset UI
            loadingState.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            uploadBox.style.pointerEvents = 'auto';
            removeBgBtn.disabled = false;
            removeBgBtn.classList.remove('disabled');
        }
    });

    // Start Over
    startOverBtn.addEventListener('click', () => {
        selectedFile = null;
        imageInput.value = '';

        previewContainer.classList.add('hidden');
        resultSection.classList.add('hidden');
        uploadContent.classList.remove('hidden');

        removeBgBtn.disabled = true;
        removeBgBtn.classList.add('disabled');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Error Toast
    function showError(message) {
        errorMessage.textContent = message;
        errorToast.classList.remove('hidden');
        void errorToast.offsetWidth; // trigger reflow for CSS transition
        errorToast.classList.add('show');

        setTimeout(() => {
            errorToast.classList.remove('show');
            setTimeout(() => errorToast.classList.add('hidden'), 400);
        }, 4000);
    }
});