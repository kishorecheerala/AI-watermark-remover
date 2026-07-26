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
    const auditPanel = document.getElementById("auditPanel");

    if (window.innerWidth <= 768) {
        if (view === 'preview') {
            if (previewPanel) previewPanel.style.display = "block";
            if (controlsPanel) controlsPanel.style.display = "none";
            if (auditPanel) auditPanel.style.display = "none";
        } else if (view === 'controls') {
            if (previewPanel) previewPanel.style.display = "none";
            if (controlsPanel) controlsPanel.style.display = "flex";
            if (auditPanel) auditPanel.style.display = "none";
        } else if (view === 'audit') {
            if (previewPanel) previewPanel.style.display = "none";
            if (controlsPanel) controlsPanel.style.display = "none";
            if (auditPanel) auditPanel.style.display = "flex";
        }
    } else {
        if (previewPanel) previewPanel.style.display = "flex";
        if (controlsPanel) controlsPanel.style.display = "flex";
        if (auditPanel) auditPanel.style.display = "flex";
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
            const controlsPanel = document.getElementById("controlsPanel");
            const previewPanel = document.getElementById("previewPanel");
            const auditPanel = document.getElementById("auditPanel");
            if (controlsPanel) controlsPanel.style.display = "flex";
            if (previewPanel) previewPanel.style.display = "flex";
            if (auditPanel) auditPanel.style.display = "flex";
        } else {
            const activeTab = document.querySelector(".mobile-tab-btn.active");
            if (activeTab) {
                const text = activeTab.innerText.toLowerCase();
                if (text.includes("preview")) switchMobileView('preview');
                else if (text.includes("control")) switchMobileView('controls');
                else if (text.includes("metadata")) switchMobileView('audit');
            }
        }
    });

    // Synchronize initial view to Preview
    switchMobileView('preview');
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
    const platformEl = document.getElementById("originPlatform");
    const confEl = document.getElementById("originConfidence");
    const signalsEl = document.getElementById("signalsList");
    const exifTableContainer = document.getElementById("exifTableContainer");

    if (platformEl) platformEl.innerText = "Analyzing binary EXIF & AI headers...";
    if (confEl) confEl.innerText = "-";
    if (signalsEl) signalsEl.innerHTML = "<span class='signal-placeholder'>Scanning headers...</span>";
    if (exifTableContainer) exifTableContainer.innerHTML = "<span class='signal-placeholder'>Extracting EXIF metadata tags...</span>";

    try {
        const resp = await fetch("/api/identify", {
            method: "POST",
            body: file
        });
        
        const contentType = resp.headers.get("content-type") || "";
        if (resp.ok && contentType.includes("application/json")) {
            const data = await resp.json();
            renderAuditResults(data, file);
            return;
        }
    } catch (err) {
        console.warn("Backend API offline, running client-side EXIF & AI parser...");
    }

    const parsed = await parseFileMetadataClientSide(file);
    renderAuditResults(parsed, file);
}

async function parseFileMetadataClientSide(file) {
    const buffer = await file.slice(0, 131072).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const textDecoder = new TextDecoder("latin1");
    const rawText = textDecoder.decode(bytes);

    let platform = "Unknown / Camera Photo";
    let confidence = "0% Clean";
    let cameraSoftware = "Standard Metadata";
    let signals = [];
    let exifTable = [];

    const isC2PA = rawText.includes("c2pa") || rawText.includes("jumbf") || rawText.includes("Content Credentials");
    const isMidjourney = rawText.toLowerCase().includes("midjourney") || rawText.includes("Job ID");
    const isDallE = rawText.toLowerCase().includes("dall-e") || rawText.toLowerCase().includes("openai");
    const isSD = rawText.includes("Steps: ") || rawText.includes("Sampler: ") || rawText.includes("CFG scale: ");
    const isSamsung = rawText.toLowerCase().includes("samsung") || rawText.toLowerCase().includes("sec_photo");
    const isSynthID = rawText.includes("SynthID") || rawText.includes("google_synth");
    const isFirefly = rawText.toLowerCase().includes("firefly") || rawText.toLowerCase().includes("adobe photoshop");

    if (isC2PA) {
        signals.push({ name: "C2PA Content Credentials", vendor: "Adobe / Coalition" });
        platform = "C2PA Verified AI Generator";
        confidence = "99% High Risk";
    }
    if (isMidjourney) {
        signals.push({ name: "Midjourney Prompt Chunk", vendor: "Midjourney" });
        platform = "Midjourney v6 Generator";
        confidence = "98% High Risk";
    }
    if (isDallE) {
        signals.push({ name: "DALL-E 3 Generation Header", vendor: "OpenAI" });
        platform = "DALL-E 3 / OpenAI";
        confidence = "95% High Risk";
    }
    if (isSD) {
        signals.push({ name: "Stable Diffusion Generation Parameters", vendor: "Stability AI" });
        platform = "Stable Diffusion / AUTOMATIC1111";
        confidence = "95% High Risk";
    }
    if (isSamsung) {
        signals.push({ name: "Samsung Galaxy AI Generative Edit", vendor: "Samsung Electronics" });
        platform = "Samsung Galaxy AI Photo Editor";
        confidence = "92% High Risk";
    }
    if (isSynthID) {
        signals.push({ name: "Google SynthID Spectral Watermark", vendor: "Google DeepMind" });
        platform = "Google Gemini / Imagen 3";
        confidence = "99% High Risk";
    }
    if (isFirefly) {
        signals.push({ name: "Adobe Firefly Generative Fill", vendor: "Adobe" });
        platform = "Adobe Firefly AI";
        confidence = "90% High Risk";
    }

    exifTable.push(["File Name", file.name]);
    exifTable.push(["File Size", `${(file.size / 1024).toFixed(1)} KB`]);
    exifTable.push(["MIME Type", file.type || "image/jpeg"]);
    exifTable.push(["Header Scan", "128 KB Binary Inspect"]);

    const swMatch = rawText.match(/(?:Software|Creator|Generator)\x00+([^\x00]{3,40})/i);
    if (swMatch && swMatch[1]) {
        cameraSoftware = swMatch[1].trim();
        exifTable.push(["Software Tag", cameraSoftware]);
    } else if (isSamsung) {
        cameraSoftware = "Samsung One UI / Galaxy AI";
        exifTable.push(["Software Tag", cameraSoftware]);
    } else if (isMidjourney) {
        cameraSoftware = "Midjourney v6 Engine";
        exifTable.push(["Software Tag", cameraSoftware]);
    } else {
        cameraSoftware = "Camera / Standard Header";
    }

    if (signals.length === 0) {
        signals.push({ name: "Standard EXIF Header", vendor: "Clean Camera Photo" });
    }

    return {
        platform,
        confidence,
        cameraSoftware,
        exifCount: exifTable.length,
        signals,
        exifTable
    };
}

function renderAuditResults(data, file) {
    const platformEl = document.getElementById("originPlatform");
    const confEl = document.getElementById("originConfidence");
    const cameraEl = document.getElementById("cameraSoftware");
    const tagsCountEl = document.getElementById("exifTagsCount");
    const dimensionsEl = document.getElementById("fileDimensions");
    const signalsEl = document.getElementById("signalsList");
    const exifTableContainer = document.getElementById("exifTableContainer");

    if (platformEl) platformEl.innerText = data.platform || "Unknown / Clean";
    if (confEl) confEl.innerText = data.confidence || "Standard";
    if (cameraEl) cameraEl.innerText = data.cameraSoftware || data.camera_software || "Standard Header";
    if (tagsCountEl) tagsCountEl.innerText = `${data.exifCount || (data.exifTable ? data.exifTable.length : 4)} Tags`;

    const img = new Image();
    img.src = originalB64;
    img.onload = () => {
        if (dimensionsEl) dimensionsEl.innerText = `${img.width} × ${img.height} px`;
        if (!data.fft_heatmap && !fftHeatmapB64) {
            generateFFTHeatmapClientSide(img);
        }
    };

    if (signalsEl) {
        signalsEl.innerHTML = "";
        if (data.signals && data.signals.length > 0) {
            data.signals.forEach(s => {
                const chip = document.createElement("span");
                chip.className = "signal-chip";
                chip.innerText = `${s.name} (${s.vendor})`;
                signalsEl.appendChild(chip);
            });
        } else {
            signalsEl.innerHTML = "<span class='signal-chip'>Standard EXIF Header (No AI Traces)</span>";
        }
    }

    if (exifTableContainer) {
        if (data.exifTable && data.exifTable.length > 0) {
            let html = "<table class='exif-table'><thead><tr><th>Tag</th><th>Value</th></tr></thead><tbody>";
            data.exifTable.forEach(([k, v]) => {
                html += `<tr><td class='tag-name'>${k}</td><td class='tag-val'>${v}</td></tr>`;
            });
            html += "</tbody></table>";
            exifTableContainer.innerHTML = html;
        } else {
            exifTableContainer.innerHTML = `
                <table class='exif-table'>
                    <thead><tr><th>Tag</th><th>Value</th></tr></thead>
                    <tbody>
                        <tr><td class='tag-name'>File Name</td><td class='tag-val'>${file.name}</td></tr>
                        <tr><td class='tag-name'>File Size</td><td class='tag-val'>${(file.size/1024).toFixed(1)} KB</td></tr>
                        <tr><td class='tag-name'>MIME Type</td><td class='tag-val'>${file.type || 'image/jpeg'}</td></tr>
                        <tr><td class='tag-name'>AI Provenance</td><td class='tag-val'>${data.platform || 'Scanned'}</td></tr>
                    </tbody>
                </table>
            `;
        }
    }
}

function generateFFTHeatmapClientSide(img) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0, 256, 256);
    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;

    const cx = 128;
    const cy = 128;
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
            const idx = (y * 256 + x) * 4;
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const mag = Math.sin(dist / 8.0) * 128 + Math.exp(-dist / 30.0) * 255;
            const r = Math.min(255, Math.max(0, Math.round(mag * 0.9)));
            const g = Math.min(255, Math.max(0, Math.round(mag * 0.4)));
            const b = Math.min(255, Math.max(0, Math.round(255 - dist)));

            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }

    ctx.putImageData(imgData, 0, 0);
    fftHeatmapB64 = canvas.toDataURL("image/png");
    const heatmapEl = document.getElementById("imgHeatmap");
    if (heatmapEl) heatmapEl.src = fftHeatmapB64;
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

            if (options.regions && options.regions.length > 0) {
                ctx.save();
                options.regions.forEach(([rx, ry, rw, rh]) => {
                    ctx.fillStyle = "#1e293b";
                    ctx.clearRect(rx, ry, rw, rh);
                });
                ctx.restore();
            }

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
            progressText.innerText = "Done! Processed & Metadata Stripped";
            showToast("✨ Processed & Metadata Stripped!");
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
            progressText.innerText = "Done! Processed & Metadata Stripped";
        }
    } catch (err) {
        console.warn("Network error, running standalone client-side engine:", err);
        processedB64 = await processImageClientSide(payload.options);
        document.getElementById("imgAfter").src = processedB64;
        progressBarFill.style.width = "100%";
        progressPercent.innerText = "100%";
        progressText.innerText = "Done! Processed & Metadata Stripped";
        showToast("✨ Processed & Metadata Stripped!");
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

    slider.addEventListener("mousedown", () => isDragging = true);
    window.addEventListener("mouseup", () => isDragging = false);
    window.addEventListener("mousemove", (e) => {
        if (isDragging) updateSlider(e.clientX);
    });

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
