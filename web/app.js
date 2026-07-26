let currentFile = null;
let batchFiles = [];
let originalB64 = null;
let processedB64 = null;
let fftHeatmapB64 = null;
let customRegions = [];
let isZoomActive = false;
let currentMode = "compare";
let currentRotateAngle = 0;
let isFlipH = false;
let isFlipV = false;

function rotateCanvas(angle) {
    currentRotateAngle = (currentRotateAngle + angle) % 360;
    alert(`Canvas rotation set to ${currentRotateAngle}°`);
}

function toggleFlip(dir) {
    if (dir === 'h') isFlipH = !isFlipH;
    if (dir === 'v') isFlipV = !isFlipV;
    alert(`Canvas flip set to H:${isFlipH}, V:${isFlipV}`);
}

document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");
    const container = document.getElementById("comparisonContainer");

    dropZone.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON") {
            fileInput.click();
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files));
        }
    });

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#6366f1";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "#334155";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#334155";
        if (e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    });

    container.addEventListener("click", (e) => {
        if (currentMode === "wand" && originalB64) {
            handleMagicWandClick(e);
        }
    });

    initSlider();
    initZoomLoupe();
});

function handleFiles(files) {
    if (files.length === 1) {
        currentFile = files[0];
        loadImage(files[0]);
    } else {
        batchFiles = files;
        currentFile = files[0];
        renderBatchQueue();
        loadImage(files[0]);
    }
}

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        originalB64 = e.target.result;
        document.getElementById("imgBefore").src = originalB64;
        document.getElementById("imgAfter").src = originalB64;
        document.getElementById("previewPlaceholder").style.display = "none";
        document.getElementById("processBtn").disabled = false;
        
        auditImage(file);
    };
    reader.readAsDataURL(file);
}

function renderBatchQueue() {
    const batchCard = document.getElementById("batchCard");
    const batchList = document.getElementById("batchList");
    const batchCount = document.getElementById("batchCount");

    batchCard.style.display = "block";
    batchCount.innerText = batchFiles.length;
    batchList.innerHTML = "";

    batchFiles.forEach((f, idx) => {
        const item = document.createElement("div");
        item.className = "batch-item";
        item.innerHTML = `<span>${f.name}</span><span style="color:#94a3b8">${(f.size / 1024).toFixed(1)} KB</span>`;
        batchList.appendChild(item);
    });
}

function clearBatch() {
    batchFiles = [];
    document.getElementById("batchCard").style.display = "none";
}

async function auditImage(file) {
    const auditCard = document.getElementById("auditCard");
    const platformEl = document.getElementById("originPlatform");
    const confEl = document.getElementById("originConfidence");
    const signalsEl = document.getElementById("signalsList");

    auditCard.style.display = "block";
    platformEl.innerText = "Analyzing provenance...";
    signalsEl.innerHTML = "";

    try {
        const resp = await fetch("/api/identify", {
            method: "POST",
            body: file
        });
        const data = await resp.json();
        platformEl.innerText = data.platform || "Unknown / Clean";
        confEl.innerText = data.confidence || "Standard";

        if (data.fft_heatmap) {
            fftHeatmapB64 = data.fft_heatmap;
            document.getElementById("imgHeatmap").src = fftHeatmapB64;
        }

        if (data.signals && data.signals.length > 0) {
            data.signals.forEach(s => {
                const chip = document.createElement("span");
                chip.className = "signal-chip";
                chip.innerText = `${s.name} (${s.vendor})`;
                signalsEl.appendChild(chip);
            });
        } else {
            signalsEl.innerHTML = "<span style='font-size:0.8rem; color:#94a3b8;'>No AI signatures detected</span>";
        }
    } catch (err) {
        platformEl.innerText = "Inspection Error";
        console.error(err);
    }
}

async function handleMagicWandClick(e) {
    const container = document.getElementById("comparisonContainer");
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const img = document.getElementById("imgBefore");
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    const px = Math.round(clickX * scaleX);
    const py = Math.round(clickY * scaleY);

    try {
        const resp = await fetch("/api/magic_wand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: originalB64, x: px, y: py })
        });
        const res = await resp.json();
        if (res.bbox) {
            customRegions.push(res.bbox);
            alert(`🪄 Magic Wand Auto-Contour Selected Box: [x:${res.bbox[0]}, y:${res.bbox[1]}, w:${res.bbox[2]}, h:${res.bbox[3]}]`);
        }
    } catch (err) {
        console.error(err);
    }
}

async function processImage() {
    if (!originalB64) return;

    const processBtn = document.getElementById("processBtn");
    const progressSection = document.getElementById("progressSection");
    const progressBarFill = document.getElementById("progressBarFill");
    const progressText = document.getElementById("progressText");
    const progressPercent = document.getElementById("progressPercent");

    processBtn.disabled = true;
    progressSection.style.display = "block";
    progressBarFill.style.width = "20%";
    progressPercent.innerText = "20%";
    progressText.innerText = "Running visible watermark localized inpainting...";

    const payload = {
        image: originalB64,
        options: {
            backend: document.getElementById("backendSelect").value,
            sensitivity: document.getElementById("sensitivitySelect").value,
            strip_metadata: document.getElementById("stripMetadata").checked,
            humanizer: document.getElementById("humanizerToggle").checked,
            face_enhance: document.getElementById("faceEnhance").checked,
            watermark_text: document.getElementById("watermarkText").value,
            auto_enhance: document.getElementById("autoEnhance").checked,
            denoise: document.getElementById("denoiseToggle").checked,
            aspect_ratio: document.getElementById("aspectRatioSelect").value,
            fit_mode: document.getElementById("fitModeSelect").value,
            rotate: currentRotateAngle,
            flip_h: isFlipH,
            flip_v: isFlipV,
            regions: customRegions
        }
    };

    try {
        progressBarFill.style.width = "60%";
        progressPercent.innerText = "60%";
        progressText.innerText = "Applying text stamper & metadata stripping...";

        const resp = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const res = await resp.json();

        if (res.success) {
            progressBarFill.style.width = "100%";
            progressPercent.innerText = "100%";
            progressText.innerText = `Done! Removed: ${res.removed_watermarks.join(", ") || "Clean / Metadata Stripped"}`;

            processedB64 = res.image_b64;
            document.getElementById("imgAfter").src = processedB64;
        } else {
            alert("Error: " + res.error);
        }
    } catch (err) {
        alert("Failed to process image: " + err);
    } finally {
        processBtn.disabled = false;
    }
}

function initSlider() {
    const container = document.getElementById("comparisonContainer");
    const overlay = document.getElementById("imgOverlay");
    const slider = document.getElementById("compSlider");

    let isDragging = false;

    slider.addEventListener("mousedown", () => isDragging = true);
    window.addEventListener("mouseup", () => isDragging = false);

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;

        const percent = (x / rect.width) * 100;
        overlay.style.width = `${percent}%`;
        slider.style.left = `${percent}%`;
    });
}

function initZoomLoupe() {
    const container = document.getElementById("comparisonContainer");
    const loupe = document.getElementById("zoomLoupe");

    container.addEventListener("mousemove", (e) => {
        if (!isZoomActive || !processedB64 && !originalB64) return;

        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        loupe.style.left = `${x - 80}px`;
        loupe.style.top = `${y - 80}px`;

        const bgImg = processedB64 || originalB64;
        loupe.style.backgroundImage = `url(${bgImg})`;
        loupe.style.backgroundSize = `${rect.width * 2}px ${rect.height * 2}px`;
        loupe.style.backgroundPosition = `-${x * 2 - 80}px -${y * 2 - 80}px`;
    });
}

function toggleZoomLoupe() {
    isZoomActive = !isZoomActive;
    const loupe = document.getElementById("zoomLoupe");
    const tabBtn = document.getElementById("tabZoom");

    loupe.style.display = isZoomActive ? "block" : "none";
    tabBtn.classList.toggle("active", isZoomActive);
}

function setPreviewMode(mode) {
    currentMode = mode;
    document.getElementById("tabCompare").classList.toggle("active", mode === "compare");
    document.getElementById("tabHeatmap").classList.toggle("active", mode === "heatmap");
    document.getElementById("tabWand").classList.toggle("active", mode === "wand");
    document.getElementById("tabErase").classList.toggle("active", mode === "erase");

    const imgHeatmap = document.getElementById("imgHeatmap");
    const helper = document.getElementById("regionHelper");
    const helperText = document.getElementById("helperText");

    if (mode === "heatmap") {
        imgHeatmap.style.display = "block";
        helper.style.display = "none";
    } else if (mode === "wand") {
        imgHeatmap.style.display = "none";
        helper.style.display = "block";
        helperText.innerText = "🪄 Click anywhere on the image above to auto-detect and snap to logo/text contours.";
    } else if (mode === "erase") {
        imgHeatmap.style.display = "none";
        helper.style.display = "block";
        helperText.innerText = "💡 Click and drag on the image above to select custom logo/watermark regions to erase.";
    } else {
        imgHeatmap.style.display = "none";
        helper.style.display = "none";
    }
}

function clearRegions() {
    customRegions = [];
    alert("Custom regions cleared.");
}
