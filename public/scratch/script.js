document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('scratch-canvas');
    const ctx = canvas.getContext('2d');
    const overImage = new Image();
    const prizeText = document.getElementById('prize-text');
    const resetBtn = document.getElementById('reset-btn');
    const settingsToggle = document.getElementById('settings-toggle');
    const closeSettingsBtn = document.getElementById('close-settings');
    const controlsPanel = document.getElementById('controls-panel');
    const modeInputs = document.querySelectorAll('input[name="mode"]');
    const numSettings = document.getElementById('number-settings');
    const listSettings = document.getElementById('list-settings');
    const minInput = document.getElementById('min-num');
    const maxInput = document.getElementById('max-num');
    const nameListInput = document.getElementById('name-list');
    const removeCheckbox = document.getElementById('remove-from-pool');
    const newBottomBtn = document.getElementById('new-bottom-btn');
    const ticketContainer = document.querySelector('.ticket-container');
    const scratchArea = document.querySelector('.scratch-area');
    const poolCountEl = document.getElementById('pool-count');
    // Custom DOM cursor for consistent hotspot behavior
    const customCursor = document.createElement('img');
    customCursor.id = 'custom-cursor';
    customCursor.src = 'hand.png';
    customCursor.style.position = 'fixed';
    customCursor.style.pointerEvents = 'none';
    customCursor.style.zIndex = '9999';
    customCursor.style.display = 'none';
    document.body.appendChild(customCursor);
    // hotspot coordinates inside the image (requested)
    const HOTSPOT_X = 30;
    const HOTSPOT_Y = 280;
    // track last mouse position so we can decide cursor visibility when settings open/close
    let lastMouseX = null, lastMouseY = null;

    function updateCustomCursorVisibility() {
        // Hide custom cursor while settings panel is visible
        if (controlsPanel.classList.contains('visible')) {
            customCursor.style.display = 'none';
            return;
        }
        // if we have a last mouse position, show/hide based on whether it's over the ticket
        if (lastMouseX === null || lastMouseY === null) return;
        const rect = ticketContainer.getBoundingClientRect();
        if (lastMouseX >= rect.left && lastMouseX <= rect.right && lastMouseY >= rect.top && lastMouseY <= rect.bottom) {
            customCursor.style.display = 'block';
        } else {
            customCursor.style.display = 'none';
        }
    }

    // Config
    let scratchRadius = 40;
    // margin in pixels to protect the image border from scratching
    const SAFE_MARGIN = 50;
    const MAX_LINE_CHARS = 10; // maximum letters per line
    const AUTO_WIPE_THRESHOLD = 0.80; // 80% of the number/name must be scratched to trigger circle reveal

    // Load the foreground image
    overImage.src = 'nameforeground.png';
    
    function initCanvas() {
        // Set canvas dimensions to match the High-Res image
        canvas.width = overImage.width;
        canvas.height = overImage.height;
        // adjust scratch radius relative to canvas size
        scratchRadius = Math.max(20, Math.round(Math.min(canvas.width, canvas.height) * 0.06));
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear existing art
        ctx.drawImage(overImage, 0, 0); // Redraw
        // Images are served locally so no taint risk. We do NOT call getImageData here —
        // even a 1-pixel read signals to the browser to de-optimize the canvas from GPU
        // to software rendering, which makes destination-out scratching slow on all
        // subsequent tickets. Reveal tracking uses path-based grid math, no getImageData needed.
        canvasReadable = true;
        // ensure prize text scales to new canvas size and build text mask
        adjustPrizeFont();
        // clear any pending auto-wipe timers
        if (scheduledAutoWipeTimer) { clearTimeout(scheduledAutoWipeTimer); scheduledAutoWipeTimer = null; }
        // initialize tracking grid (after text mask exists)
        initGrid();
        // Now it is safe to show the prize text (canvas foreground is drawn over it)
        prizeText.style.visibility = 'visible';
    }

    // --- Pool & prize formatting ---
    let pool = [];
    let currentPrize = null;

    const SETTINGS_KEY = 'studentPickerSettingsV1';

    function saveSettings() {
        const mode = document.querySelector('input[name="mode"]:checked')?.value || 'number';
        const settings = {
            mode,
            min: parseInt(minInput.value) || 1,
            max: parseInt(maxInput.value) || 100,
            names: nameListInput.value || '',
            removeFromPool: !!(removeCheckbox && removeCheckbox.checked),
            pool
        };
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            // ignore storage failures
        }
    }

    function loadSettings() {
        let raw = null;
        try {
            raw = localStorage.getItem(SETTINGS_KEY);
        } catch (e) {
            raw = null;
        }
        if (!raw) {
            updatePoolCount();
            return;
        }
        try {
            const settings = JSON.parse(raw);
            if (settings.mode === 'list' || settings.mode === 'number') {
                const modeInput = Array.from(modeInputs).find(m => m.value === settings.mode);
                if (modeInput) modeInput.checked = true;
                if (settings.mode === 'number') {
                    numSettings.style.display = 'block';
                    listSettings.style.display = 'none';
                } else {
                    numSettings.style.display = 'none';
                    listSettings.style.display = 'block';
                }
            }
            if (typeof settings.min === 'number') minInput.value = settings.min;
            if (typeof settings.max === 'number') maxInput.value = settings.max;
            if (typeof settings.names === 'string') nameListInput.value = settings.names;
            if (removeCheckbox && typeof settings.removeFromPool === 'boolean') {
                removeCheckbox.checked = settings.removeFromPool;
            }
            if (Array.isArray(settings.pool)) {
                pool = settings.pool.slice();
            }
        } catch (e) {
            // ignore corrupt data and start fresh
        }
        updatePoolCount();
    }

    function buildPool() {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        pool = [];
        if (mode === 'number') {
            const min = parseInt(minInput.value) || 1;
            const max = parseInt(maxInput.value) || 100;
            for (let i = min; i <= max; i++) pool.push(String(i));
        } else {
            const text = nameListInput.value.trim();
            if (!text) return;
            pool = text.split('\n').map(s => s.trim()).filter(Boolean);
        }
        updatePoolCount();
        saveSettings();
    }

    function pickFromPool() {
        if (!pool || pool.length === 0) return null;
        const idx = Math.floor(Math.random() * pool.length);
        const v = pool[idx];
        return { value: v, index: idx };
    }

    function removeFromPoolAt(idx) {
        if (idx >= 0 && idx < pool.length) pool.splice(idx, 1);
        updatePoolCount();
        saveSettings();
    }

    function updatePoolCount() {
        if (!poolCountEl) return;
        poolCountEl.textContent = String(pool ? pool.length : 0);
    }

    function wrapToMax(text) {
        // Wrap text into lines with at most MAX_LINE_CHARS each (break words if needed)
        const words = String(text).split(/\s+/);
        const lines = [];
        let cur = '';
        for (let w of words) {
            while (w.length > MAX_LINE_CHARS) {
                const part = w.slice(0, MAX_LINE_CHARS);
                if (cur) { lines.push(cur); cur = ''; }
                lines.push(part);
                w = w.slice(MAX_LINE_CHARS);
            }
            if (!cur) cur = w;
            else if ((cur + ' ' + w).replace(/\s+/g,'').length <= MAX_LINE_CHARS) cur += ' ' + w;
            else { lines.push(cur); cur = w; }
        }
        if (cur) lines.push(cur);
        return lines.join('\n');
    }

    function setPrizeText(text) {
        currentPrize = text;
        // try to keep the prize on a single line and let adjustPrizeFont shrink it to fit
        prizeText.textContent = String(text);
        adjustPrizeFont();
    }

    function adjustPrizeFont() {
        // Resize font so the text fits into scratchArea and uses the available space.
        const rect = scratchArea.getBoundingClientRect();
        const lines = prizeText.textContent ? prizeText.textContent.split('\n').length : 1;
        const width = Math.max(100, rect.width * 0.9);
        const height = Math.max(40, rect.height * 0.6);
        // estimate: use smaller of width/(max chars * factor) and height/lines
        const approxChars = MAX_LINE_CHARS;
        const sizeFromWidth = width / (approxChars * 0.55);
        const sizeFromHeight = height / Math.max(1, lines * 0.9);
        const fontSize = Math.min(sizeFromWidth, sizeFromHeight);
        let finalSize = Math.max(18, Math.floor(fontSize));
        // If it's a short numeric or single short line, make it bigger and add letter spacing
        const textContent = prizeText.textContent || '';
        const manualLines = textContent.split('\n');
        const prizeStr = (currentPrize !== null && currentPrize !== undefined) ? String(currentPrize) : textContent;
        const computed = getComputedStyle(prizeText);
        const family = computed.fontFamily || 'Fredoka One, sans-serif';
        const minFont = 12;
        // target width is the scratch area inner width (leave some padding)
        const widthLimit = Math.max(60, scratchArea.getBoundingClientRect().width * 0.92);
        const heightLimit = Math.max(24, scratchArea.getBoundingClientRect().height * 0.6);
        // Try to keep single-line when possible (user wants up to 10 chars on one line)
        let chosenSize = finalSize;
        const measureCanvas = document.createElement('canvas');
        const mctx = measureCanvas.getContext('2d');
        // Start from a generous size (based on earlier calc) and shrink until it fits
        mctx.font = `${chosenSize}px ${family}`;
        const wantSingleLine = manualLines.length === 1 && prizeStr.length <= Math.max(MAX_LINE_CHARS, 10);
        const isNumeric = /^\d+$/.test(prizeStr);
        if (wantSingleLine) {
            // Numbers and very short strings get a much larger target so they fill the area
            const isLarge = isNumeric || prizeStr.length <= 3;
            const activeHeightLimit = isLarge
                ? Math.max(24, scratchArea.getBoundingClientRect().height * 0.90)
                : heightLimit;
            const activeWidthLimit = isLarge
                ? Math.max(60, scratchArea.getBoundingClientRect().width * 0.82)
                : widthLimit;
            // Start from the large height limit and shrink until both dimensions fit
            chosenSize = Math.floor(activeHeightLimit);
            mctx.font = `${chosenSize}px ${family}`;
            let measured = mctx.measureText(prizeStr).width;
            if (!measured || measured <= 0) measured = activeWidthLimit + 1;
            while ((measured > activeWidthLimit || chosenSize > activeHeightLimit) && chosenSize > minFont) {
                chosenSize -= 1;
                mctx.font = `${chosenSize}px ${family}`;
                measured = mctx.measureText(prizeStr).width;
            }
            if (isLarge) {
                prizeText.style.letterSpacing = '0.06em';
            } else {
                prizeText.style.letterSpacing = '0em';
            }
        } else {
            // Allow multiple lines: keep previously computed finalSize
            prizeText.style.letterSpacing = '0em';
            chosenSize = Math.min(finalSize, Math.floor(heightLimit / Math.max(1, manualLines.length)));
        }
        prizeText.style.whiteSpace = wantSingleLine ? 'nowrap' : 'normal';
        prizeText.style.fontSize = Math.max(minFont, Math.floor(chosenSize)) + 'px';
        // Rebuild text mask so reveal calculations are based on actual rendered text
        updateTextMask();
    }

    window.addEventListener('resize', () => {
        adjustPrizeFont();
    });

    // --- Reveal tracking & auto-wipe ---
    function getRevealRatio(sampleStep = 4) {
        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return 0;
        try {
            const data = ctx.getImageData(0, 0, w, h).data;
            let cleared = 0;
            let total = 0;
            for (let y = 0; y < h; y += sampleStep) {
                for (let x = 0; x < w; x += sampleStep) {
                    const idx = (y * w + x) * 4 + 3; // alpha
                    total++;
                    if (data[idx] < 128) cleared++;
                }
            }
            return cleared / total;
        } catch (err) {
            return 0;
        }
    }

    let wipeInProgress = false;
    // token to allow cancelling an in-progress autoWipe when starting a new ticket
    let wipeToken = 0;

    function cancelWipe() {
        wipeToken++;
        wipeInProgress = false;
        if (scheduledAutoWipeTimer) {
            clearTimeout(scheduledAutoWipeTimer);
            scheduledAutoWipeTimer = null;
        }
        // ensure future drawing starts from normal compositing
        ctx.globalCompositeOperation = 'source-over';
    }

    // Grid used only for markAllCleared (state after auto-wipe)
    let grid = null;
    let gridW = 0;
    let gridH = 0;
    let clearedCells = 0;
    let totalCells = 0;
    let cellSize = 8;

    // Text pixel mask: which pixels belong to the number/name (1 = text). Reveal is measured
    // by actually reading the scratch canvas at these pixels, not from stroke path.
    let textPixelMask = null;  // Uint8Array of length canvas.width * canvas.height
    let totalTextPixels = 0;

    let textMaskCanvas = null;
    let textMaskCtx = null;

    // When canvas is tainted (e.g. cross-origin image), getImageData throws. Use path-based fallback.
    let canvasReadable = true;
    // Path-based fallback: which grid cells overlap the text (for when we can't read pixels)
    let textGridCells = null;  // Uint8Array, 1 = cell has text
    let textGridTotal = 0;
    let textGridCleared = 0;

    function initGrid() {
        const minDim = Math.min(canvas.width, canvas.height);
        cellSize = Math.max(4, Math.floor(minDim / 80));
        gridW = Math.max(1, Math.ceil(canvas.width / cellSize));
        gridH = Math.max(1, Math.ceil(canvas.height / cellSize));
        totalCells = gridW * gridH;
        grid = new Uint8Array(totalCells);
        clearedCells = 0;
        textGridCells = new Uint8Array(totalCells);
        textGridTotal = 0;
        textGridCleared = 0;
        if (textPixelMask && canvas.width > 0 && canvas.height > 0) {
            const w = canvas.width;
            const h = canvas.height;
            for (let gy = 0; gy < gridH; gy++) {
                for (let gx = 0; gx < gridW; gx++) {
                    const cx = Math.min(w - 1, Math.floor(gx * cellSize + cellSize / 2));
                    const cy = Math.min(h - 1, Math.floor(gy * cellSize + cellSize / 2));
                    const i = cy * w + cx;
                    if (i < textPixelMask.length && textPixelMask[i]) {
                        textGridCells[gy * gridW + gx] = 1;
                        textGridTotal++;
                    }
                }
            }
        }
    }

    function markClearedAt(cx, cy) {
        if (!grid) return;
        if (cx < SAFE_MARGIN || cy < SAFE_MARGIN || cx > canvas.width - SAFE_MARGIN || cy > canvas.height - SAFE_MARGIN) return;
        const r = Math.max(1, Math.ceil((scratchRadius * 1.6) / cellSize));
        const gx = Math.floor(cx / cellSize);
        const gy = Math.floor(cy / cellSize);
        const minX = Math.max(0, gx - r);
        const maxX = Math.min(gridW - 1, gx + r);
        const minY = Math.max(0, gy - r);
        const maxY = Math.min(gridH - 1, gy + r);
        for (let yy = minY; yy <= maxY; yy++) {
            for (let xx = minX; xx <= maxX; xx++) {
                const idx = yy * gridW + xx;
                if (!grid[idx]) {
                    grid[idx] = 1;
                    clearedCells++;
                    if (textGridCells && textGridCells[idx]) textGridCleared++;
                }
            }
        }
    }

    // Measure reveal by reading the scratch canvas: of the pixels that are "text", how many are cleared (alpha < 128)?
    const REVEAL_SAMPLE_STEP = 2; // sample every 2nd pixel for performance on large canvases
    function getTextRevealRatio() {
        if (!textPixelMask || totalTextPixels === 0) return 0;
        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return 0;
        try {
            const scratchData = ctx.getImageData(0, 0, w, h).data;
            let revealed = 0;
            let textSampled = 0;
            for (let y = 0; y < h; y += REVEAL_SAMPLE_STEP) {
                for (let x = 0; x < w; x += REVEAL_SAMPLE_STEP) {
                    const i = y * w + x;
                    if (textPixelMask[i]) {
                        textSampled++;
                        if (scratchData[i * 4 + 3] < 128) revealed++;
                    }
                }
            }
            return textSampled === 0 ? 0 : revealed / textSampled;
        } catch (e) {
            return 0;
        }
    }

    // Fallback when there is no text mask: proportion of scratch area (safe rect) that is cleared
    function getCanvasClearedRatio() {
        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return 0;
        const step = 4;
        let total = 0;
        let cleared = 0;
        try {
            const data = ctx.getImageData(0, 0, w, h).data;
            for (let y = SAFE_MARGIN; y < h - SAFE_MARGIN; y += step) {
                for (let x = SAFE_MARGIN; x < w - SAFE_MARGIN; x += step) {
                    total++;
                    if (data[(y * w + x) * 4 + 3] < 128) cleared++;
                }
            }
            return total === 0 ? 0 : cleared / total;
        } catch (e) {
            return 0;
        }
    }

    // Fallback when getImageData fails (tainted canvas): use path-based text cells
    function getPathBasedRevealRatio() {
        if (textGridCells && textGridTotal > 0) return textGridCleared / textGridTotal;
        if (grid && totalCells > 0) return clearedCells / totalCells;
        return 0;
    }

    function getCombinedRevealRatio() {
        if (!canvasReadable) return getPathBasedRevealRatio();
        if (textPixelMask && totalTextPixels > 0) {
            const r = getTextRevealRatio();
            // If pixel read failed (e.g. tainted mid-session or large canvas) use path-based
            if (r > 0 || textGridTotal === 0) return r;
            return getPathBasedRevealRatio();
        }
        return getCanvasClearedRatio();
    }

    function updateTextMask() {
        // Text pixel mask is not needed: reveal ratio uses fast grid-based path (no getImageData).
        // Skipped to avoid the synchronous getImageData call that freezes the window.
        textPixelMask = null;
        totalTextPixels = 0;
    }

    function autoWipe() {
        if (wipeInProgress) return;
        wipeInProgress = true;
        const myToken = ++wipeToken;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxR = Math.hypot(Math.max(cx - SAFE_MARGIN, 0), Math.max(cy - SAFE_MARGIN, 0)) * 1.6;
        let r = 0;
        let start = null;
        const duration = 700;
        function step(t) {
            // if a new ticket started, abort this wipe
            if (myToken !== wipeToken) {
                wipeInProgress = false;
                return;
            }
            if (start === null) start = t;
            // clamp progress to [0,1] to avoid negative eased values
            let p = (t - start) / duration;
            p = Math.max(0, Math.min(1, p));
            // ease-out
            const eased = 1 - Math.pow(1 - p, 3);
            r = eased * maxR;
            // Clip to safe inner rect so the border remains immune
            ctx.save();
            ctx.beginPath();
            ctx.rect(SAFE_MARGIN, SAFE_MARGIN, canvas.width - SAFE_MARGIN * 2, canvas.height - SAFE_MARGIN * 2);
            ctx.clip();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (p < 1) requestAnimationFrame(step);
            else {
                wipeInProgress = false;
                markAllCleared();
                showNewButton();
            }
        }
        requestAnimationFrame(step);
    }

    function markAllCleared() {
        if (!grid) return;
        for (let i = 0; i < totalCells; i++) grid[i] = 1;
        clearedCells = totalCells;
        textGridCleared = textGridTotal;
    }

    function showNewButton() {
        if (newBottomBtn) newBottomBtn.style.display = 'inline-block';
    }

    function hideNewButton() {
        if (newBottomBtn) newBottomBtn.style.display = 'none';
    }

    // Scheduled auto-wipe (won't be cancelled unintentionally)
    let scheduledAutoWipeTimer = null;
    function onStopCheckAutoWipe() {
        // Use fast grid-based estimate (no getImageData) for threshold check to avoid lag
        const ratio = getPathBasedRevealRatio();
        if (ratio >= AUTO_WIPE_THRESHOLD) {
            if (scheduledAutoWipeTimer) return; // already scheduled
            scheduledAutoWipeTimer = setTimeout(() => {
                autoWipe();
                scheduledAutoWipeTimer = null;
            }, 300);
        }
    }

    overImage.onload = () => {
        initCanvas();
    };

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    // RAF throttle for scratch drawing
    let rafPending = false;
    let pendingScratchX = 0;
    let pendingScratchY = 0;

    function scheduleScratch(x, y) {
        pendingScratchX = x;
        pendingScratchY = y;
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                if (isDrawing) scratch(pendingScratchX, pendingScratchY);
            });
        }
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left) * (canvas.width / rect.width),
            y: (evt.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    // Show and move the custom cursor when over the whole ticket container
    ticketContainer.addEventListener('mouseenter', () => {
        customCursor.style.display = 'block';
    });
    ticketContainer.addEventListener('mouseleave', () => {
        customCursor.style.display = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX; lastMouseY = e.clientY;
        // only follow when over ticket container (or when drawing)
        const rect = ticketContainer.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            customCursor.style.left = (e.clientX - HOTSPOT_X) + 'px';
            customCursor.style.top = (e.clientY - HOTSPOT_Y) + 'px';
            // only show if settings panel is not visible
            if (!controlsPanel.classList.contains('visible')) customCursor.style.display = 'block';
        } else {
            customCursor.style.display = 'none';
        }
    });

    function scratch(x, y) {
          // Clip erase operations to inside the safe margin so the border is immune
          ctx.save();
          ctx.beginPath();
          ctx.rect(SAFE_MARGIN, SAFE_MARGIN, canvas.width - SAFE_MARGIN * 2, canvas.height - SAFE_MARGIN * 2);
          ctx.clip();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = scratchRadius * 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          // Draw stroke
          ctx.beginPath();
          if (lastX === 0 && lastY === 0) {
              ctx.moveTo(x, y);
          } else {
              ctx.moveTo(lastX, lastY);
          }
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.restore();

        // Mark cleared cells along the stroke path for reveal tracking
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(dist / (scratchRadius * 0.6)));
        if (lastX === 0 && lastY === 0) {
            markClearedAt(x, y);
        } else {
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const xi = lastX + dx * t;
                const yi = lastY + dy * t;
                markClearedAt(xi, yi);
            }
        }

        lastX = x;
        lastY = y;
    }

    // --- Interaction Logic ---
    
    // Start drawing when mouse is pressed ANYWHERE (as requested)
    document.addEventListener('mousedown', (e) => {
        // Prevent selection/dragging when clicking on non-UI areas
        const target = e.target;
        const isUi = target.closest && (target.closest('#controls-panel') || target.closest('.controls') || target.closest('.bottom-controls') || target.closest('#settings-toggle') || target.closest('#reset-btn'));
        if (!isUi) e.preventDefault();
        isDrawing = true;
        
        // If clicking directly on canvas, start scratching immediately and set start pos
        const rect = canvas.getBoundingClientRect();
        const isInCanvas = (
            e.clientX >= rect.left && 
            e.clientX <= rect.right && 
            e.clientY >= rect.top && 
            e.clientY <= rect.bottom
        );

        if (isInCanvas) {
            const pos = getMousePos(canvas, e);
            lastX = pos.x;
            lastY = pos.y;
            scratch(pos.x, pos.y);
        } else {
            // Reset last position if starting from outside
            lastX = 0;
            lastY = 0;
        }
    });

    // Stop drawing when mouse is released ANYWHERE
    document.addEventListener('mouseup', () => {
        isDrawing = false;
        lastX = 0; // Reset path
        lastY = 0;
        onStopCheckAutoWipe();
    });

    // Track movement on the document to handle entering/leaving the canvas smoothly
    document.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;

        // Check if the mouse is physically over the canvas element
        const rect = canvas.getBoundingClientRect();
        const isInCanvas = (
            e.clientX >= rect.left && 
            e.clientX <= rect.right && 
            e.clientY >= rect.top && 
            e.clientY <= rect.bottom
        );

        if (isInCanvas) {
            const pos = getMousePos(canvas, e);
            // If we just entered the canvas, start a new path segment from current pos
            if (lastX === 0 && lastY === 0) {
                lastX = pos.x;
                lastY = pos.y;
            }
            scheduleScratch(pos.x, pos.y);
        } else {
            // If we leave the canvas, break the line segment so we don't draw a line across the gap if we return
            lastX = 0;
            lastY = 0;
        }
    });

    // --- Touch Events (similar logic) ---
    // Show hand cursor at touch position (touch has no native cursor)
    function updateCustomCursorFromTouch(clientX, clientY) {
        if (controlsPanel.classList.contains('visible')) return;
        const rect = ticketContainer.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            customCursor.style.left = (clientX - HOTSPOT_X) + 'px';
            customCursor.style.top = (clientY - HOTSPOT_Y) + 'px';
            customCursor.style.display = 'block';
        }
    }
    function hideCustomCursorForTouch() {
        customCursor.style.display = 'none';
    }

    // Start touch anywhere
    document.addEventListener('touchstart', (e) => {
        const target = e.target;
        const isUi = target.closest && (target.closest('#controls-panel') || target.closest('.controls') || target.closest('.bottom-controls') || target.closest('#settings-toggle') || target.closest('#reset-btn'));
        // Prevent default for non-UI touches to avoid selecting/dragging images while scratching
        if (!isUi) e.preventDefault();
        
        const touch = e.touches[0];
        if (touch) updateCustomCursorFromTouch(touch.clientX, touch.clientY);

        isDrawing = true;
        
        if (e.target === canvas) {
            const pos = getMousePos(canvas, touch);
            lastX = pos.x;
            lastY = pos.y;
            scratch(pos.x, pos.y);
        } else {
            lastX = 0;
            lastY = 0;
        }
    }, { passive: false }); // mark listener as non-passive to allow preventDefault

    document.addEventListener('touchend', () => {
        isDrawing = false;
        lastX = 0;
        lastY = 0;
        hideCustomCursorForTouch();
        onStopCheckAutoWipe();
    });
    document.addEventListener('touchcancel', () => {
        isDrawing = false;
        lastX = 0;
        lastY = 0;
        hideCustomCursorForTouch();
    });

    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (touch) updateCustomCursorFromTouch(touch.clientX, touch.clientY);

        if (!isDrawing) return;
        
        // Check if touch is over canvas
        const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (elementUnderFinger === canvas) {
            e.preventDefault(); // Prevent scrolling while scratching
            const pos = getMousePos(canvas, touch);
             if (lastX === 0 && lastY === 0) {
                lastX = pos.x;
                lastY = pos.y;
            }
            scheduleScratch(pos.x, pos.y);
        } else {
            lastX = 0;
            lastY = 0;
        }
    }, { passive: false });

    // Prevent images from being draggable or selected
    document.querySelectorAll('img').forEach(img => {
        try { img.draggable = false; } catch (e) {}
        img.style.userSelect = 'none';
        img.style.webkitUserSelect = 'none';
    });

    // Block native dragstart for images unless interacting with UI
    document.addEventListener('dragstart', (e) => {
        const tgt = e.target;
        const isUi = tgt.closest && (tgt.closest('#controls-panel') || tgt.closest('.controls') || tgt.closest('.bottom-controls') || tgt.closest('#settings-toggle') || tgt.closest('#reset-btn'));
        if (!isUi && tgt.tagName === 'IMG') e.preventDefault();
    });


    // --- UI & Game Logic ---

    // Toggle Settings Panel
    settingsToggle.addEventListener('click', () => {
        controlsPanel.classList.toggle('visible');
        updateCustomCursorVisibility();
    });

    closeSettingsBtn.addEventListener('click', () => {
        controlsPanel.classList.remove('visible');
        updateCustomCursorVisibility();
    });

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (!controlsPanel.contains(e.target) && !settingsToggle.contains(e.target) && controlsPanel.classList.contains('visible')) {
            controlsPanel.classList.remove('visible');
            updateCustomCursorVisibility();
        }
    });

    // Toggle settings visibility based on mode
    modeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.value === 'number') {
                numSettings.style.display = 'block';
                listSettings.style.display = 'none';
            } else {
                numSettings.style.display = 'none';
                listSettings.style.display = 'block';
            }
            saveSettings();
        });
    });

    // Persist changes when user edits settings fields
    ['change', 'input'].forEach(evt => {
        minInput.addEventListener(evt, saveSettings);
        maxInput.addEventListener(evt, saveSettings);
        nameListInput.addEventListener(evt, saveSettings);
        if (removeCheckbox) removeCheckbox.addEventListener(evt, saveSettings);
    });

    function getRandomItem() {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        
        if (mode === 'number') {
            const min = parseInt(minInput.value) || 1;
            const max = parseInt(maxInput.value) || 100;
            if (min > max) return "Error";
            return Math.floor(Math.random() * (max - min + 1)) + min;
        } else {
            const text = nameListInput.value.trim();
            if (!text) return "No Names";
            const lines = text.split('\n').filter(line => line.trim() !== '');
            if (lines.length === 0) return "Empty List";
            const randomIndex = Math.floor(Math.random() * lines.length);
            return lines[randomIndex];
        }
    }

    // Panel reset button: pick new from pool and reset
    resetBtn.addEventListener('click', () => {
        // stop any in-progress or scheduled wipe before drawing a new ticket
        cancelWipe();
        buildPool();
        const picked = pickFromPool();
        if (picked) {
            setPrizeText(picked.value);
            if (removeCheckbox && removeCheckbox.checked) removeFromPoolAt(picked.index);
        } else {
            setPrizeText(getRandomItem());
        }
        initCanvas();
        hideNewButton();
        controlsPanel.classList.remove('visible');
    });

    // Load any saved settings/pool so multiple pickers can share them
    loadSettings();

    // Auto-pick from pool on first load if pool is non-empty (avoids showing ???)
    if (pool && pool.length > 0) {
        const picked = pickFromPool();
        if (picked) {
            prizeText.style.visibility = 'hidden';
            setPrizeText(picked.value);
            if (removeCheckbox && removeCheckbox.checked) removeFromPoolAt(picked.index);
        } else {
            prizeText.style.visibility = 'hidden';
            prizeText.textContent = '';
        }
    } else {
        prizeText.style.visibility = 'hidden';
        prizeText.textContent = '' ;
    }
    hideNewButton();

    // Bottom new button behavior with animate out/in
    newBottomBtn.addEventListener('click', () => {
        // prevent re-click while animating, and stop any current wipe
        hideNewButton();
        cancelWipe();
        ticketContainer.classList.add('animate-out');
        ticketContainer.addEventListener('animationend', function handleOut(e) {
            if (e.animationName === 'exitRight') {
                ticketContainer.classList.remove('animate-out');
                // Cancel any pending RAF scratch so it doesn't fire on the fresh canvas
                rafPending = false;
                isDrawing = false;
                lastX = 0; lastY = 0;
                prizeText.style.visibility = 'hidden';
                if (!pool || pool.length === 0) buildPool();
                const picked = pickFromPool();
                if (picked) {
                    setPrizeText(picked.value);
                    if (removeCheckbox && removeCheckbox.checked) removeFromPoolAt(picked.index);
                } else {
                    setPrizeText(getRandomItem());
                }
                initCanvas();
                ticketContainer.classList.add('animate-in');
                ticketContainer.addEventListener('animationend', function handleIn(ev) {
                    if (ev.animationName === 'enterFromLeft') {
                        ticketContainer.classList.remove('animate-in');
                        ticketContainer.removeEventListener('animationend', handleIn);
                    }
                });
                ticketContainer.removeEventListener('animationend', handleOut);
            }
        });
    });
});