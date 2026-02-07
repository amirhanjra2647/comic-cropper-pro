// Cropper Tool JavaScript
let canvas;
let currentImage = null;
let previews = [];
let originalImages = []; // Store original image data for high-quality export

// Initialize Fabric.js canvas
document.addEventListener('DOMContentLoaded', () => {
    // Get container size
    const canvasArea = document.querySelector('.cropper-canvas-area');
    const width = canvasArea ? canvasArea.clientWidth - 40 : 800;
    const height = canvasArea ? canvasArea.clientHeight - 40 : 600;

    canvas = new fabric.Canvas('cropCanvas', {
        backgroundColor: '#1a1a1a',
        selection: true,
        width: width,
        height: height
    });

    // Custom delete control
    fabric.Object.prototype.controls.deleteControl = new fabric.Control({
        x: 0.5,
        y: -0.5,
        offsetY: -16,
        offsetX: 16,
        cursorStyle: 'pointer',
        mouseUpHandler: deleteObject,
        render: renderDeleteIcon
    });

    setupEventListeners();

    // Handle window resize
    window.addEventListener('resize', () => {
        const canvasArea = document.querySelector('.cropper-canvas-area');
        if (canvasArea && canvas.getObjects().length === 0) {
            const newWidth = canvasArea.clientWidth - 40;
            const newHeight = canvasArea.clientHeight - 40;
            canvas.setDimensions({ width: newWidth, height: newHeight });
            canvas.renderAll();
        }
    });
});

function setupEventListeners() {
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    document.getElementById('detectBtn').addEventListener('click', detectPanels);
    document.getElementById('clearBtn').addEventListener('click', clearAll);
    document.getElementById('downloadBtn').addEventListener('click', downloadZip);
    document.getElementById('batchUpload')?.addEventListener('change', handleBatchUpload);

    canvas.on('object:modified', updatePreviews);
    canvas.on('object:added', updatePreviews);
    canvas.on('object:removed', updatePreviews);

    // Enable manual rectangle drawing
    enableRectangleDrawing();
}

function enableRectangleDrawing() {
    let isDrawing = false;
    let rect = null;
    let startX, startY;

    canvas.on('mouse:down', function (opt) {
        const evt = opt.e;
        // Only draw if clicking on empty space (not on any object)
        if (opt.target) return;

        isDrawing = true;
        const pointer = canvas.getPointer(evt);
        startX = pointer.x;
        startY = pointer.y;

        rect = new fabric.Rect({
            left: startX,
            top: startY,
            width: 0,
            height: 0,
            fill: 'rgba(59, 130, 246, 0.1)',
            stroke: '#3b82f6',
            strokeWidth: 3,
            cornerColor: '#f59e0b',
            cornerSize: 12,
            transparentCorners: false,
            selectable: true
        });
        canvas.add(rect);
        canvas.bringToFront(rect); // Rectangles on top
        canvas.setActiveObject(rect);
    });

    canvas.on('mouse:move', function (opt) {
        if (!isDrawing || !rect) return;

        const pointer = canvas.getPointer(opt.e);

        const left = Math.min(pointer.x, startX);
        const top = Math.min(pointer.y, startY);
        const width = Math.abs(pointer.x - startX);
        const height = Math.abs(pointer.y - startY);

        rect.set({
            left: left,
            top: top,
            width: width,
            height: height
        });

        canvas.renderAll();
    });

    canvas.on('mouse:up', function () {
        if (!isDrawing) return;
        isDrawing = false;

        // Remove rectangle if too small
        if (rect && (rect.width < 10 || rect.height < 10)) {
            canvas.remove(rect);
        }

        rect = null;
        canvas.renderAll();
        updatePreviews();
    });
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const dataURL = await readFileAsDataURL(file);
    const img = await loadFabricImage(dataURL);

    canvas.clear();
    canvas.backgroundColor = '#1a1a1a';
    previews = [];

    img.set({
        left: 0,
        top: 0,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockRotation: true,
        cornerColor: '#3b82f6',
        cornerSize: 10,
        borderColor: '#3b82f6',
        transparentCorners: false
    });

    canvas.add(img);
    currentImage = file;

    // Set canvas size to image size
    canvas.setDimensions({
        width: img.width,
        height: img.height
    });

    // Calculate zoom to fit in viewport
    const canvasArea = document.querySelector('.cropper-canvas-area');
    const containerWidth = canvasArea.clientWidth - 40;
    const containerHeight = canvasArea.clientHeight - 40;

    const scaleX = containerWidth / img.width;
    const scaleY = containerHeight / img.height;
    const scale = Math.min(scaleX, scaleY, 1);

    canvas.setZoom(scale);

    // Reset viewport
    canvas.viewportTransform[4] = 0;
    canvas.viewportTransform[5] = 0;

    canvas.renderAll();

    // Scroll to top
    canvasArea.scrollTop = 0;
    canvasArea.scrollLeft = 0;

    document.getElementById('detectBtn').disabled = false;
    updatePreviewsDisplay();
}

async function detectPanels() {
    if (!currentImage) return;

    const formData = new FormData();
    formData.append('file', currentImage);

    try {
        const response = await fetch('/api/detect/', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        // Remove existing rectangles
        canvas.getObjects('rect').forEach(obj => canvas.remove(obj));

        // Add detected panels
        data.panels.forEach(panel => {
            const rect = new fabric.Rect({
                left: panel.left,
                top: panel.top,
                width: panel.width,
                height: panel.height,
                fill: 'rgba(59, 130, 246, 0.1)',
                stroke: '#3b82f6',
                strokeWidth: 3,
                cornerColor: '#f59e0b',
                cornerSize: 12,
                transparentCorners: false
            });
            canvas.add(rect);
        });

        canvas.renderAll();
        updatePreviews();
    } catch (error) {
        console.error('Detection error:', error);
        alert('Failed to detect panels');
    }
}

function updatePreviews() {
    const rects = canvas.getObjects('rect').filter(r => r.selectable);
    previews = [];

    if (rects.length === 0) {
        updatePreviewsDisplay();
        return;
    }

    // Get the scale factor used
    const images = canvas.getObjects('image');
    const imageScale = images.length > 0 ? (images[0].scaleX || 1) : 1;

    console.log(`Generating ${rects.length} preview(s) at full resolution (scale factor: ${imageScale.toFixed(2)})`);

    // For each rectangle, crop at full resolution
    rects.forEach((rect, idx) => {
        try {
            // Calculate crop coordinates on original images
            const rectLeft = rect.left;
            const rectTop = rect.top;
            const rectWidth = rect.width * rect.scaleX;
            const rectHeight = rect.height * rect.scaleY;

            // Find which original image this rectangle overlaps
            let foundImage = null;
            for (let i = 0; i < originalImages.length; i++) {
                const origImg = originalImages[i];
                const imgTop = origImg.canvasTop;
                const imgBottom = imgTop + (origImg.originalHeight * origImg.scale);

                if (rectTop >= imgTop && rectTop < imgBottom) {
                    foundImage = origImg;
                    break;
                }
            }

            if (foundImage) {
                // Crop from original image at full resolution
                const offscreenCanvas = document.createElement('canvas');
                const ctx = offscreenCanvas.getContext('2d');

                // Calculate crop coordinates in original image space
                const cropX = Math.max(0, (rectLeft - foundImage.canvasLeft) / foundImage.scale);
                const cropY = Math.max(0, (rectTop - foundImage.canvasTop) / foundImage.scale);
                const cropW = rectWidth / foundImage.scale;
                const cropH = rectHeight / foundImage.scale;

                // Set output canvas to original resolution
                offscreenCanvas.width = cropW;
                offscreenCanvas.height = cropH;

                // Load original image and crop
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                    const dataURL = offscreenCanvas.toDataURL('image/png');
                    previews.push(dataURL);
                    console.log(`Preview ${idx + 1}: ${Math.round(cropW)}x${Math.round(cropH)} (original resolution)`);
                    updatePreviewsDisplay();
                };
                img.src = foundImage.dataURL;
            } else {
                // Fallback: export from canvas with multiplier
                const dataURL = canvas.toDataURL({
                    left: rectLeft,
                    top: rectTop,
                    width: rectWidth,
                    height: rectHeight,
                    format: 'png',
                    multiplier: 1 / imageScale
                });
                previews.push(dataURL);
                console.log(`Preview ${idx + 1}: fallback export`);
                updatePreviewsDisplay();
            }
        } catch (e) {
            console.error('Preview export error:', e);
        }
    });
}

function updatePreviewsDisplay() {
    const grid = document.getElementById('previewGrid');
    const count = document.getElementById('previewCount');

    grid.innerHTML = '';
    count.textContent = previews.length;

    previews.forEach((src, idx) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${src}" alt="Panel ${idx + 1}">
            <div class="preview-item-footer">
                <span>Panel ${idx + 1}</span>
                <button onclick="downloadSingle(${idx})" style="background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #fff; padding: 0.25rem 0.75rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.8rem;">
                    📥 Download
                </button>
            </div>
        `;
        grid.appendChild(div);
    });

    document.getElementById('downloadBtn').disabled = previews.length === 0;
}

// Add to global scope
window.downloadSingle = function (idx) {
    const dataURL = previews[idx];
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `panel_${idx + 1}.png`;
    link.click();
};

async function downloadZip() {
    if (previews.length === 0) return;

    const zip = new JSZip();

    previews.forEach((dataURL, idx) => {
        const base64 = dataURL.split(',')[1];
        zip.file(`panel_${idx + 1}.png`, base64, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'cropped_panels.zip');
}
function clearAll() {
    // Remove all objects (rectangles, images, separators)
    canvas.clear();
    canvas.backgroundColor = '#1a1a1a';
    canvas.renderAll();
    previews = [];
    currentImage = null;
    updatePreviewsDisplay();
    document.getElementById('detectBtn').disabled = true;
}

async function handleBatchUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    console.log(`Starting batch upload of ${files.length} images...`);

    // Get canvas container width
    const canvasArea = document.querySelector('.cropper-canvas-area');
    const canvasWidth = canvasArea.clientWidth - 40;

    console.log(`Canvas width: ${canvasWidth}`);

    // Clear canvas
    canvas.clear();
    canvas.backgroundColor = '#1a1a1a';
    previews = [];
    originalImages = [];
    currentImage = null;

    try {
        // Load all images in parallel
        const imagePromises = files.map(async (file, index) => {
            console.log(`[${index + 1}/${files.length}] Loading: ${file.name}`);
            try {
                const dataURL = await readFileAsDataURL(file);
                const fabricImg = await loadFabricImage(dataURL);
                console.log(`[${index + 1}/${files.length}] ✓ Loaded: ${file.name} (${fabricImg.width}x${fabricImg.height})`);
                return { success: true, img: fabricImg, dataURL: dataURL, filename: file.name, index };
            } catch (error) {
                console.error(`[${index + 1}/${files.length}] ✗ Failed: ${file.name}`, error);
                return { success: false, filename: file.name, error: error.message };
            }
        });

        const results = await Promise.all(imagePromises);
        const loadedImages = results.filter(r => r.success);

        if (loadedImages.length === 0) {
            alert('❌ No images could be loaded.');
            return;
        }

        console.log(`✓ Successfully loaded ${loadedImages.length}/${files.length} images`);

        // Calculate scale to fit width only (not height)
        let maxNaturalWidth = 0;
        loadedImages.forEach(({ img }) => {
            maxNaturalWidth = Math.max(maxNaturalWidth, img.width);
        });

        const scale = Math.min(canvasWidth / maxNaturalWidth, 1); // Scale to fit width, max 100%

        console.log(`Max width: ${maxNaturalWidth}, Scale to width: ${scale.toFixed(2)}`);

        // Add padding for drawing rectangles (100px on each side)
        const padding = 100;
        const imageAreaWidth = canvasWidth - (padding * 2);
        const adjustedScale = Math.min(imageAreaWidth / maxNaturalWidth, 1);

        // Calculate total height needed (with extra padding)
        let totalHeight = padding; // Top padding
        loadedImages.forEach(({ img }) => {
            totalHeight += (img.height * adjustedScale) + 50; // 50px between images
        });
        totalHeight += padding; // Bottom padding

        // Set canvas size with room for rectangles
        canvas.setDimensions({
            width: canvasWidth,
            height: totalHeight
        });

        console.log(`Canvas dimensions: ${canvasWidth}x${totalHeight} (with ${padding}px padding)`);

        // Add scaled images to canvas with padding
        let currentY = padding; // Start with top padding
        loadedImages.forEach(({ img, dataURL, filename }, idx) => {
            // Store original for high-quality export
            originalImages.push({
                dataURL: dataURL,
                canvasTop: currentY,
                canvasLeft: padding,
                scale: adjustedScale,
                originalWidth: img.width,
                originalHeight: img.height
            });

            // Scale image to fit
            img.scale(adjustedScale);

            img.set({
                left: padding,
                top: currentY,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                lockRotation: true,
                name: filename,
                cornerColor: '#3b82f6',
                cornerSize: 10,
                borderColor: '#3b82f6',
                transparentCorners: false
            });

            canvas.add(img);

            const scaledHeight = img.height * adjustedScale;
            console.log(`Added image ${idx + 1} at Y=${currentY}: ${filename} (${Math.round(img.width * adjustedScale)}x${Math.round(scaledHeight)})`);
            currentY += scaledHeight + 50; // 50px gap between images
        });

        canvas.renderAll();

        // Scroll canvas area to top
        const canvasArea = document.querySelector('.cropper-canvas-area');
        canvasArea.scrollTop = 0;

        alert(`✅ Loaded ${loadedImages.length} image(s) at ${Math.round(adjustedScale * 100)}% scale. Scroll to see all. ${padding}px padding for drawing.`);
        console.log('Batch upload complete.');

    } catch (error) {
        console.error('Batch upload error:', error);
        alert('❌ Error loading images.');
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function loadFabricImage(dataURL) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Image load timeout (10s)'));
        }, 10000);

        fabric.Image.fromURL(dataURL, (img) => {
            clearTimeout(timeout);
            if (!img || !img.width || !img.height) {
                reject(new Error('Invalid image - no dimensions'));
            } else {
                resolve(img);
            }
        });
    });
}

function clearAll() {
    // Remove all objects (rectangles, images, separators)
    canvas.clear();
    canvas.backgroundColor = '#1a1a1a';
    canvas.renderAll();
    previews = [];
    currentImage = null;
    updatePreviewsDisplay();
    document.getElementById('detectBtn').disabled = true;
}

function deleteObject(eventData, transform) {
    const target = transform.target;
    const canvas = target.canvas;
    canvas.remove(target);
    canvas.requestRenderAll();
    updatePreviews(); // Update previews after deletion
    return true;
}

function renderDeleteIcon(ctx, left, top, styleOverride, fabricObject) {
    const size = 24;
    ctx.save();
    ctx.translate(left, top);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(6, 6);
    ctx.moveTo(6, -6);
    ctx.lineTo(-6, 6);
    ctx.stroke();
    ctx.restore();
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
