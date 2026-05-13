document.addEventListener('DOMContentLoaded', () => {
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

    const BASE_URL = 'https://remove-bg-nwl7.onrender.com';
    const API_URL = `${BASE_URL}/remove-bg`;

    // ── Wake server on page load ───────────────────────────────
    // Render free tier sleeps after 15 min inactivity.
    // Pinging / early gives it a head-start before user clicks.
    fetch(`${BASE_URL}/`, { method: 'GET', mode: 'cors' })
        .then(r => { if (r.ok) console.log('Server is awake.'); })
        .catch(() => console.log('Server ping failed (may be waking up).'));

    // ── Upload box events ──────────────────────────────────────
    uploadBox.addEventListener('click', (e) => {
        if (e.target !== changeImageBtn) imageInput.click();
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
        if (e.dataTransfer.files?.length) handleFile(e.dataTransfer.files[0]);
    });
    imageInput.addEventListener('change', (e) => {
        if (e.target.files?.length) handleFile(e.target.files[0]);
    });
    changeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imageInput.click();
    });

    // ── File validation ────────────────────────────────────────
    function handleFile(file) {
        const valid = ['image/jpeg', 'image/png', 'image/webp'];
        if (!valid.includes(file.type)) {
            showError('Please select a valid image (JPG, PNG, WEBP).');
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            showError('Image must be under 4 MB.');
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

    // ── Fetch with retry ───────────────────────────────────────
    // Retries up to 4 times on 502/503 (Render cold-start crash).
    // Waits 5 s between attempts and updates UI text so the user
    // knows what is happening instead of seeing a blank spinner.
    async function fetchWithRetry(url, options, maxRetries = 4, delayMs = 5000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (attempt > 1) {
                setLoadingText(`Server is waking up… (attempt ${attempt}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delayMs));
            }
            try {
                const response = await fetch(url, options);
                if ((response.status === 502 || response.status === 503) && attempt < maxRetries) {
                    console.warn(`Attempt ${attempt}: got ${response.status}, retrying…`);
                    continue;
                }
                return response;
            } catch (err) {
                console.warn(`Attempt ${attempt} network error:`, err.message);
                if (attempt === maxRetries) throw err;
            }
        }
    }

    function setLoadingText(text) {
        if (loadingText) loadingText.textContent = text;
    }

    // ── Main action ────────────────────────────────────────────
    removeBgBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // Enter loading state
        previewContainer.classList.add('hidden');
        loadingState.classList.remove('hidden');
        uploadBox.style.pointerEvents = 'none';
        removeBgBtn.disabled = true;
        removeBgBtn.classList.add('disabled');
        resultSection.classList.add('hidden');
        setLoadingText('Removing background…');

        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            const response = await fetchWithRetry(API_URL, {
                method: 'POST',
                body: formData
                // Do NOT set Content-Type — browser adds multipart boundary automatically
            });

            if (!response.ok) {
                let msg = 'Failed to process image. Please try again.';
                try { const d = await response.json(); if (d.error) msg = d.error; } catch (_) { }
                throw new Error(msg);
            }

            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            resultImage.src = imageUrl;
            downloadBtn.href = imageUrl;

            const dot = selectedFile.name.lastIndexOf('.');
            const base = dot !== -1 ? selectedFile.name.substring(0, dot) : selectedFile.name;
            downloadBtn.download = `${base}_nobg.png`;

            // Show result
            loadingState.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            uploadBox.style.pointerEvents = 'auto';
            resultSection.classList.remove('hidden');
            setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);

        } catch (err) {
            console.error('Error:', err);
            const msg = (err.message && err.message !== 'Failed to fetch')
                ? err.message
                : 'Server is still waking up. Please wait 30 seconds and try again.';
            showError(msg);

            loadingState.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            uploadBox.style.pointerEvents = 'auto';
            removeBgBtn.disabled = false;
            removeBgBtn.classList.remove('disabled');
        }
    });

    // ── Start over ─────────────────────────────────────────────
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

    // ── Error toast ────────────────────────────────────────────
    function showError(message) {
        errorMessage.textContent = message;
        errorToast.classList.remove('hidden');
        void errorToast.offsetWidth;
        errorToast.classList.add('show');
        setTimeout(() => {
            errorToast.classList.remove('show');
            setTimeout(() => errorToast.classList.add('hidden'), 400);
        }, 5000);
    }
});