const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzcecvS-yi7CwCWnqIxXRcJKkXU9E7y_-h6L3ZOT7HjbRh4KdIbI0CbhjmCYmxXwynz/exec";

// --- DOM ELEMENT SELECTION ---
const uploadBox = document.querySelector(".upload-box");
const fileInput = document.getElementById("file-upload");
// State Containers
const allStates = {
    default: document.getElementById("default-state"),
    progress: document.getElementById("progress-state"),
    success: document.getElementById("success-state"),
    error: document.getElementById("error-state"),
};
// Progress & Success List Elements
const progressTitle = document.getElementById("progress-title");
const progressList = document.getElementById("progress-file-list");
const successList = document.getElementById("success-file-list");
// Buttons
const uploadAnotherBtn = document.getElementById("upload-another");
const tryAgainBtn = document.getElementById("try-again");

// --- GLOBAL STATE ---
let fileQueue = [];
let successfulUploads = [];

// --- UI STATE MANAGEMENT ---
const showState = (stateName) => {
    Object.values(allStates).forEach(state => state.style.display = 'none');
    allStates[stateName].style.display = 'block';
};

// --- CORE LOGIC ---

// Handles the initial selection of files
const handleFileSelection = (selectedFiles) => {
    if (GOOGLE_SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
        alert("🚨 Please update the GOOGLE_SCRIPT_URL in script.js.");
        return;
    }

    fileQueue = Array.from(selectedFiles);
    successfulUploads = []; // Reset success list
    if (fileQueue.length === 0) return;

    setupProgressUI();
    showState('progress');
    uploadNextFileInQueue(); // Start the upload process
};

// Creates the initial list of files in the "progress" view
const setupProgressUI = () => {
    progressList.innerHTML = '';
    progressTitle.textContent = `Uploading 1/${fileQueue.length}`;
    fileQueue.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-list-item';
        li.id = `file-item-${index}`;
        li.innerHTML = `
            <span class="filename">${file.name}</span>
            <span class="status">Waiting...</span>
            <div class="file-progress"></div>
        `;
        progressList.appendChild(li);
    });
};

// The main engine: uploads files one by one
const uploadNextFileInQueue = async () => {
    if (fileQueue.length === 0) {
        // All files are processed
        if (successfulUploads.length > 0) {
            setupSuccessUI();
            showState('success');
        } else {
            // This case happens if all files failed
            alert("All file uploads failed.");
            showState('default');
        }
        return;
    }

    const file = fileQueue[0]; // Get the next file without removing it yet
    const fileIndex = Array.from(fileInput.files).length - fileQueue.length;
    const listItem = document.getElementById(`file-item-${fileIndex}`);
    const statusDiv = listItem.querySelector('.status');
    const progressBar = listItem.querySelector('.file-progress');

    progressTitle.textContent = `Uploading ${fileIndex + 1}/${Array.from(fileInput.files).length}`;
    statusDiv.textContent = 'Processing...';
    statusDiv.className = 'status processing';
    
    try {
        const base64Content = await getBase64(file);
        const payload = {
            filename: file.name,
            mimeType: file.type,
            fileContent: base64Content.split(",")[1],
        };

        const res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.status === 'success') {
            progressBar.style.width = '100%';
            statusDiv.textContent = 'Complete';
            statusDiv.className = 'status success';
            successfulUploads.push({ name: file.name, url: data.downloadUrl });
        } else {
            throw new Error(data.message || 'Unknown server error');
        }
    } catch (error) {
        console.error("Upload failed for:", file.name, error);
        statusDiv.textContent = 'Failed';
        statusDiv.className = 'status error';
        // A file failed, but we continue with the next one
    } finally {
        fileQueue.shift(); // Remove the processed file from the queue
        uploadNextFileInQueue(); // Process the next one
    }
};

// Renders the final success screen with download links
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

// Helper to convert file to Base64 using Promises
const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

// --- EVENT LISTENERS ---
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
tryAgainBtn.addEventListener('click', () => showState('default')); // Kept for general errors

// --- INITIAL STATE ---
showState('default');