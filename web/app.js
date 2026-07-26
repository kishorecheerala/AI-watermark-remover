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
    showToast(`Canvas rotation: ${currentRotateAngle}°`);
}

function toggleFlip(dir) {
    if (dir === 'h') isFlipH = !isFlipH;
    if (dir === 'v') isFlipV = !isFlipV;
    showToast(`Canvas flip: H:${isFlipH ? 'On' : 'Off'}, V:${isFlipV ? 'On' : 'Off'}`);
}

function showToast(msg) {
    const existing = document.querySelector(".studio-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "studio-toast";
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.95);
        color: #f8fafc;
        border: 1px solid rgba(99, 102, 241, 0.4);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        z-index: 2000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        backdrop-filter: blur(8px);
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function switchMobileView(view) {
    const tabs = document.querySelectorAll(".mobile-tab-btn");
    tabs.forEach(t => t.classList.remove("active"));

    const activeIndex = view === 'preview' ? 0 : (view === 'controls' ? 1 : 2);
    if (tabs[activeIndex]) tabs[activeIndex].classList.add("active");

    const controlsPanel = document.getElementById("controlsPanel");
    const previewPanel = document.getElementById("previewPanel");
    const auditCard = document.getElementById("auditCard");

    if (window.innerWidth <= 768) {
        if (view === 'preview') {
            previewPanel.style.display = "block";
            controlsPanel.style.display = "none";
        } else if (view === 'controls') {
            previewPanel.style.display = "none";
            controlsPanel.style.display = "flex";
            if (auditCard) auditCard.style.display = "none";
        } else if (view === 'audit') {
            previewPanel.style.display = "none";
            controlsPanel.style.display = "flex";
            if (auditCard) auditCard.style.display = "block";
        }
    } else {
        previewPanel.style.display = "flex";
        controlsPanel.style.display = "flex";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");
    const container = document.getElementById("comparisonContainer");

    dropZone.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON" && e.target.tagName !== "INPUT") {
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
        dropZone.style.borderColor = "rgba(99, 102, 241, 0.3)";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "rgba(99, 102, 241, 0.3)";
        if (e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    });

    container.addEventListener("click", (e) => {
        if (currentMode === "wand" && originalB64) {
            handleMagicWandClick(e);
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
            document.getElementById("controlsPanel").style.display = "flex";
            document.getElementById("previewPanel").style.display = "flex";
        }
    });

    initSlider();
    initZoomLoupe();
});

function setProcessButtonsDisabled(disabled) {
    const btn1 = document.getElementById("processBtn");
    const btn2 = document.getElementById("mobileProcessBtn");
    if (btn1) btn1.disabled = disabled;
    if (btn2) btn2.disabled = disabled;
}

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
        
        setProcessButtonsDisabled(false);
        auditImage(file);

        if (window.innerWidth <= 768) {
            switchMobileView('preview');
        }
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

    batchFiles.forEach((f) => {
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
        
        const contentType = resp.headers.get("content-type") || "";
        if (!resp.ok || !contentType.includes("application/json")) {
            platformEl.innerText = "Standalone Offline Mode";
            confEl.innerText = "Local Canvas";
            signalsEl.innerHTML = "<span style='font-size:0.75rem; color:#a5b4fc;'>Running standalone client engine</span>";
            return;
        }

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
            signalsEl.innerHTML = "<span style='font-size:0.75rem; color:#94a3b8;'>No AI signatures detected</span>";
        }
    } catch (err) {
        platformEl.innerText = "Standalone Offline Mode";
        confEl.innerText = "Local Canvas";
        signalsEl.innerHTML = "<span style='font-size:0.75rem; color:#a5b4fc;'>Running standalone client engine</span>";
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
        
        const contentType = resp.headers.get("content-type") || "";
        if (resp.ok && contentType.includes("application/json")) {
            const res = await resp.json();
            if (res.bbox) {
                customRegions.push(res.bbox);
                showToast(`🪄 Magic Wand Box: [x:${res.bbox[0]}, y:${res.bbox[1]}, w:${res.bbox[2]}, h:${res.bbox[3]}]`);
                return;
            }
        }
    } catch (err) {
        console.error(err);
    }

    // Local fallback region selector box when server API unavailable
    const boxW = Math.round(img.naturalWidth * 0.15);
    const boxH = Math.round(img.naturalHeight * 0.15);
    const rx = Math.max(0, px - Math.round(boxW / 2));
    const ry = Math.max(0, py - Math.round(boxH / 2));
    const localBox = [rx, ry, boxW, boxH];
    customRegions.push(localBox);
    showToast(`🪄 Magic Wand Box: [x:${rx}, y:${ry}, w:${boxW}, h:${boxH}]`);
}

async function processImageClientSide(options) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            let w = img.width;
            let h = img.height;

            const rotate = options.rotate || 0;
            if (rotate === 90 || rotate === 270) {
                canvas.width = h;
                canvas.height = w;
            } else {
                canvas.width = w;
                canvas.height = h;
            }

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotate * Math.PI) / 180);

            const scaleX = options.flip_h ? -1 : 1;
            const scaleY = options.flip_v ? -1 : 1;
            ctx.scale(scaleX, scaleY);

            ctx.drawImage(img, -w / 2, -h / 2);
            ctx.restore();

            // Clear custom regions if specified
            if (options.regions && options.regions.length > 0) {
                ctx.save();
                options.regions.forEach(([rx, ry, rw, rh]) => {
                    ctx.fillStyle = "#1e293b";
                    ctx.clearRect(rx, ry, rw, rh);
                });
                ctx.restore();
            }

            // Draw custom copyright stamper if present
            if (options.watermark_text) {
                ctx.save();
                ctx.font = "bold 20px Inter, sans-serif";
                ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
                ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                ctx.shadowBlur = 4;
                ctx.fillText(options.watermark_text, 20, canvas.height - 25);
                ctx.restore();
            }

            resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.src = originalB64;
    });
}

async function processImage() {
    if (!originalB64) return;

    const progressSection = document.getElementById("progressSection");
    const progressBarFill = document.getElementById("progressBarFill");
    const progressText = document.getElementById("progressText");
    const progressPercent = document.getElementById("progressPercent");

    setProcessButtonsDisabled(true);
    progressSection.style.display = "block";
    progressBarFill.style.width = "20%";
    progressPercent.innerText = "20%";
    progressText.innerText = "Processing image...";

    const backendEl = document.getElementById("backendSelect");
    const sensEl = document.getElementById("sensitivitySelect");
    const stripEl = document.getElementById("stripMetadata");
    const humanEl = document.getElementById("humanizerToggle");
    const faceEl = document.getElementById("faceEnhance");
    const textEl = document.getElementById("watermarkText");
    const colorEl = document.getElementById("autoEnhance");
    const denoiseEl = document.getElementById("denoiseToggle");
    const aspectEl = document.getElementById("aspectRatioSelect");
    const fitEl = document.getElementById("fitModeSelect");

    const payload = {
        image: originalB64,
        options: {
            backend: backendEl ? backendEl.value : "auto",
            sensitivity: sensEl ? sensEl.value : "medium",
            strip_metadata: stripEl ? stripEl.checked : true,
            humanizer: humanEl ? humanEl.checked : false,
            face_enhance: faceEl ? faceEl.checked : false,
            watermark_text: textEl ? textEl.value : "",
            auto_enhance: colorEl ? colorEl.checked : false,
            denoise: denoiseEl ? denoiseEl.checked : false,
            aspect_ratio: aspectEl ? aspectEl.value : "original",
            fit_mode: fitEl ? fitEl.value : "blur_pad",
            rotate: currentRotateAngle,
            flip_h: isFlipH,
            flip_v: isFlipV,
            regions: customRegions
        }
    };

    try {
        progressBarFill.style.width = "60%";
        progressPercent.innerText = "60%";
        progressText.innerText = "Applying canvas transformations & watermark cleanup...";

        const resp = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const contentType = resp.headers.get("content-type") || "";

        if (!resp.ok || !contentType.includes("application/json")) {
            console.warn("Server API not available; invoking local client-side canvas engine.");
            processedB64 = await processImageClientSide(payload.options);
            document.getElementById("imgAfter").src = processedB64;
            progressBarFill.style.width = "100%";
            progressPercent.innerText = "100%";
            progressText.innerText = "Done! Processed with Standalone Local Canvas Engine";
            showToast("✨ Processed with Standalone Local Canvas Engine!");
            if (window.innerWidth <= 768) switchMobileView('preview');
            return;
        }

        const res = await resp.json();

        if (res.success) {
            progressBarFill.style.width = "100%";
            progressPercent.innerText = "100%";
            progressText.innerText = `Done! Removed: ${res.removed_watermarks.join(", ") || "Clean / Metadata Stripped"}`;

            processedB64 = res.image_b64;
            document.getElementById("imgAfter").src = processedB64;
            showToast("✨ Image processed successfully!");

            if (window.innerWidth <= 768) {
                switchMobileView('preview');
            }
        } else {
            showToast("Falling back to local client canvas engine...");
            processedB64 = await processImageClientSide(payload.options);
            document.getElementById("imgAfter").src = processedB64;
            progressBarFill.style.width = "100%";
            progressPercent.innerText = "100%";
            progressText.innerText = "Done! Processed with Standalone Local Canvas Engine";
        }
    } catch (err) {
        console.warn("Network error, running standalone client-side engine:", err);
        processedB64 = await processImageClientSide(payload.options);
        document.getElementById("imgAfter").src = processedB64;
        progressBarFill.style.width = "100%";
        progressPercent.innerText = "100%";
        progressText.innerText = "Done! Processed with Standalone Local Canvas Engine";
        showToast("✨ Processed with Standalone Local Canvas Engine!");
        if (window.innerWidth <= 768) switchMobileView('preview');
    } finally {
        setProcessButtonsDisabled(false);
    }
}

function initSlider() {
    const container = document.getElementById("comparisonContainer");
    const overlay = document.getElementById("imgOverlay");
    const slider = document.getElementById("compSlider");

    let isDragging = false;

    const updateSlider = (clientX) => {
        const rect = container.getBoundingClientRect();
        let x = clientX - rect.left;
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;

        const percent = (x / rect.width) * 100;
        overlay.style.width = `${percent}%`;
        slider.style.left = `${percent}%`;
    };

    // Mouse Events
    slider.addEventListener("mousedown", () => isDragging = true);
    window.addEventListener("mouseup", () => isDragging = false);
    window.addEventListener("mousemove", (e) => {
        if (isDragging) updateSlider(e.clientX);
    });

    // Touch Events for Mobile Responsiveness
    slider.addEventListener("touchstart", (e) => {
        isDragging = true;
        if (e.touches.length > 0) updateSlider(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener("touchend", () => isDragging = false);
    window.addEventListener("touchmove", (e) => {
        if (isDragging && e.touches.length > 0) {
            updateSlider(e.touches[0].clientX);
        }
    }, { passive: true });
}

function initZoomLoupe() {
    const container = document.getElementById("comparisonContainer");
    const loupe = document.getElementById("zoomLoupe");

    const updateLoupe = (clientX, clientY) => {
        if (!isZoomActive || (!processedB64 && !originalB64)) return;

        const rect = container.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        loupe.style.left = `${x - 70}px`;
        loupe.style.top = `${y - 70}px`;

        const bgImg = processedB64 || originalB64;
        loupe.style.backgroundImage = `url(${bgImg})`;
        loupe.style.backgroundSize = `${rect.width * 2}px ${rect.height * 2}px`;
        loupe.style.backgroundPosition = `-${x * 2 - 70}px -${y * 2 - 70}px`;
    };

    container.addEventListener("mousemove", (e) => updateLoupe(e.clientX, e.clientY));
    container.addEventListener("touchmove", (e) => {
        if (e.touches.length > 0) updateLoupe(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
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
        if (helper) helper.style.display = "none";
    } else if (mode === "wand") {
        imgHeatmap.style.display = "none";
        if (helper) helper.style.display = "flex";
        if (helperText) helperText.innerText = "🪄 Tap anywhere on image to auto-detect watermark contours.";
    } else if (mode === "erase") {
        imgHeatmap.style.display = "none";
        if (helper) helper.style.display = "flex";
        if (helperText) helperText.innerText = "💡 Drag on image to select custom regions to erase.";
    } else {
        imgHeatmap.style.display = "none";
        if (helper) helper.style.display = "none";
    }
}

function clearRegions() {
    customRegions = [];
    showToast("Custom regions cleared");
}
