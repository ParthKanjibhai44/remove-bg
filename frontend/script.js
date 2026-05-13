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

    // ── Auto-detect local vs live ──────────────────────────────
    // On localhost / file:// → local Flask on port 5000
    // On InfinityFree live site → Railway backend
    const isLocal = (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'file:'
    );

    const BASE_URL = isLocal
        ? 'http://127.0.0.1:5000'                               // local Flask
        : 'https://remove-bg-production-d122.up.railway.app';   // Railway live

    const API_URL = `${BASE_URL}/remove-bg`;

    console.log(`[config] isLocal=${isLocal}  API=${API_URL}`);

    // ── Wake server on page load ───────────────────────────────
    // Railway keeps the server alive (no cold start like Render free),
    // but we still ping to confirm it's reachable.
    fetch(`${BASE_URL}/`, { method: 'GET', mode: 'cors' })
        .then(r => {
            if (r.ok) console.log('Server is awake and ready.');
            else console.warn(`Server ping returned ${r.status}`);
        })
        .catch(() => console.warn('Server ping failed.'));

    // ── Upload box ─────────────────────────────────────────────
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
    // Railway doesn't sleep like Render free tier, so fewer retries needed.
    // Still retry on transient 502/503 errors.
    async function fetchWithRetry(url, options) {
        const maxRetries = isLocal ? 1 : 3;
        const delayMs = 3000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (attempt > 1) {
                setLoadingText(`Retrying… (attempt ${attempt}/${maxRetries})`);
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
                // Do NOT set Content-Type — browser sets multipart boundary automatically
            });

            if (!response.ok) {
                let msg = 'Failed to process image. Please try again.';
                try {
                    const d = await response.json();
                    if (d.error) msg = d.error;
                } catch (_) { }
                throw new Error(msg);
            }

            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            resultImage.src = imageUrl;
            downloadBtn.href = imageUrl;

            const dot = selectedFile.name.lastIndexOf('.');
            const base = dot !== -1 ? selectedFile.name.substring(0, dot) : selectedFile.name;
            downloadBtn.download = `${base}_nobg.png`;

            loadingState.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            uploadBox.style.pointerEvents = 'auto';
            resultSection.classList.remove('hidden');
            setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);

        } catch (err) {
            console.error('Error:', err);
            const msg = (err.message && err.message !== 'Failed to fetch')
                ? err.message
                : 'Could not reach the server. Please check your connection and try again.';
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