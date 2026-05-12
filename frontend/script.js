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
    const resultSection = document.getElementById('resultSection');
    const resultImage = document.getElementById('resultImage');
    const downloadBtn = document.getElementById('downloadBtn');
    const startOverBtn = document.getElementById('startOverBtn');
    const errorToast = document.getElementById('errorToast');
    const errorMessage = document.getElementById('errorMessage');

    let selectedFile = null;

    // === CONFIGURATION ===
    // IMPORTANT: Change this URL to your deployed Render/Railway backend URL
    // before uploading these files to InfinityFree.
    // Example: const API_URL = 'https://my-remove-bg-app.onrender.com/remove-bg';
    const API_URL = 'http://localhost:5000/remove-bg'; 

    // Event Listeners for Upload Box
    uploadBox.addEventListener('click', (e) => {
        // Prevent click if we are clicking the change image button
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
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showError('Please select a valid image file (JPG, PNG, WEBP).');
            return;
        }

        // Validate file size (e.g., max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showError('Image size should be less than 5MB.');
            return;
        }

        selectedFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            uploadContent.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            
            // Enable submit button
            removeBgBtn.disabled = false;
            removeBgBtn.classList.remove('disabled');
        };
        reader.readAsDataURL(file);
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

        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData,
                // Don't set Content-Type header, let the browser set it automatically with the boundary for FormData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to process image. Please try again.');
            }

            // The response is an image blob
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            // Show Result
            resultImage.src = imageUrl;
            downloadBtn.href = imageUrl;
            
            // Original filename logic to append _nobg
            const originalName = selectedFile.name;
            const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
            downloadBtn.download = `${nameWithoutExt}_nobg.png`;

            // UI State: Result
            loadingState.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            uploadBox.style.pointerEvents = 'auto';
            resultSection.classList.remove('hidden');
            
            // Scroll to result
            setTimeout(() => {
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);

        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
            
            // Reset UI State on error
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
        
        // Scroll back to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Error Handling Toast
    function showError(message) {
        errorMessage.textContent = message;
        errorToast.classList.remove('hidden');
        
        // Trigger reflow for transition
        void errorToast.offsetWidth;
        
        errorToast.classList.add('show');

        setTimeout(() => {
            errorToast.classList.remove('show');
            setTimeout(() => {
                errorToast.classList.add('hidden');
            }, 400); // Wait for transition to finish
        }, 3000);
    }
});
