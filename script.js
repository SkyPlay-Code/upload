// ================= CONFIGURATION =================
// 1. YOUR GOOGLE SCRIPT URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzcecvS-yi7CwCWnqIxXRcJKkXU9E7y_-h6L3ZOT7HjbRh4KdIbI0CbhjmCYmxXwynz/exec";

// 2. YOUR PYTHON BACKEND URL
const SHORTENER_API_URL = "https://skypcode.pythonanywhere.com/api/shorten"; 
// =================================================

// --- DOM ELEMENTS ---
const uploadBox = document.querySelector(".upload-box");
const fileInput = document.getElementById("file-upload");
const allStates = {
    default: document.getElementById("default-state"),
    progress: document.getElementById("progress-state"),
    success: document.getElementById("success-state"),
    error: document.getElementById("error-state"),
};
const progressTitle = document.getElementById("progress-title");
const progressList = document.getElementById("progress-file-list");
const successList = document.getElementById("success-file-list");
const uploadAnotherBtn = document.getElementById("upload-another");
const tryAgainBtn = document.getElementById("try-again");

// --- STATE ---
let fileQueue = [];
let successfulUploads = [];

// --- FUNCTIONS ---
const showState = (stateName) => {
    Object.values(allStates).forEach(state => state.style.display = 'none');
    allStates[stateName].style.display = 'block';
};

const handleFileSelection = (selectedFiles) => {
    fileQueue = Array.from(selectedFiles);
    successfulUploads = [];
    if (fileQueue.length === 0) return;
    setupProgressUI();
    showState('progress');
    uploadNextFileInQueue();
};

const setupProgressUI = () => {
    progressList.innerHTML = '';
    progressTitle.textContent = `Uploading 1/${fileQueue.length}`;
    fileQueue.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-list-item';
        li.id = `file-item-${index}`;
        li.innerHTML = `<span class="filename">${file.name}</span><span class="status">Waiting...</span><div class="file-progress"></div>`;
        progressList.appendChild(li);
    });
};

const uploadNextFileInQueue = async () => {
    if (fileQueue.length === 0) {
        if (successfulUploads.length > 0) {
            setupSuccessUI();
            showState('success');
        } else {
            alert("All file uploads failed.");
            showState('default');
        }
        return;
    }

    const file = fileQueue[0];
    const fileIndex = Array.from(fileInput.files).length - fileQueue.length;
    const listItem = document.getElementById(`file-item-${fileIndex}`);
    const statusDiv = listItem.querySelector('.status');
    const progressBar = listItem.querySelector('.file-progress');

    progressTitle.textContent = `Uploading ${fileIndex + 1}/${Array.from(fileInput.files).length}`;
    statusDiv.textContent = 'Processing...';
    statusDiv.className = 'status processing';
    
    try {
        // --- STEP 1: UPLOAD TO GOOGLE DRIVE ---
        const base64Content = await getBase64(file);
        const payload = {
            filename: file.name,
            mimeType: file.type,
            fileContent: base64Content.split(",")[1],
        };

        const res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.status === 'success') {
            progressBar.style.width = '50%'; // Halfway there
            const longDriveUrl = data.downloadUrl;
            
            // --- STEP 2: SHORTEN WITH PYTHON ---
            statusDiv.textContent = 'Shortening...';
            
            let finalUrl = longDriveUrl; // Default to long URL
            
            try {
                // Send the Long URL to your Python Backend
                const shortRes = await fetch(SHORTENER_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: longDriveUrl })
                });

                // CHECK: Did the Python server say 200 OK?
                if (!shortRes.ok) {
                    throw new Error(`Server Error: ${shortRes.status}`);
                }

                const shortData = await shortRes.json();
                
                if (shortData.status === 'success') {
                    finalUrl = shortData.short_url;
                } else {
                    console.error("Shortener Logic Error:", shortData);
                    // alert("Shortener says: " + JSON.stringify(shortData)); // Uncomment to debug logic
                }
            } catch (shortErr) {
                // !!! THIS IS WHERE IT IS FAILING !!!
                console.error("SHORTENER FAILED:", shortErr);
                alert("Shortener Failed! \nReason: " + shortErr.message + "\n\n(Don't worry, using long link instead)");
            }

            // --- FINISH ---
            progressBar.style.width = '100%';
            statusDiv.textContent = 'Complete';
            statusDiv.className = 'status success';
            successfulUploads.push({ name: file.name, url: finalUrl });
            
        } else {
            throw new Error(data.message || 'Google Drive Error');
        }
    } catch (error) {
        console.error("Upload failed:", error);
        statusDiv.textContent = 'Failed';
        statusDiv.className = 'status error';
        alert("Upload Failed: " + error.message);
    } finally {
        fileQueue.shift();
        uploadNextFileInQueue();
    }
};

const setupSuccessUI = () => {
    successList.innerHTML = '';
    successfulUploads.forEach(upload => {
        const li = document.createElement('li');
        li.className = 'file-list-item';
        li.innerHTML = `
            <span class="filename">${upload.name}</span>
            <a href="${upload.url}" class="download-link" target="_blank">Download</a>
        `;
        successList.appendChild(li);
    });
};

const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

// --- EVENTS ---
uploadBox.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFileSelection(e.target.files));
uploadBox.addEventListener("dragover", (e) => { e.preventDefault(); uploadBox.classList.add("dragover"); });
uploadBox.addEventListener("dragleave", () => uploadBox.classList.remove("dragover"));
uploadBox.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadBox.classList.remove("dragover");
    handleFileSelection(e.dataTransfer.files);
});
uploadAnotherBtn.addEventListener('click', () => showState('default'));
tryAgainBtn.addEventListener('click', () => showState('default'));
showState('default');