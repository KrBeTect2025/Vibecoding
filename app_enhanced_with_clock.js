// Global variables
let editor;
let isTerminalCollapsed = false;
let isResizing = false;
let currentResizeType = null;

// Global variables for input handling
let currentSessionId = null;
let isWaitingForInput = false;

// Global search variables
let searchWidget = null;
let isReplaceMode = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    initializeTheme(); // Initialize theme FIRST
    initMonacoEditor();
    initResizers();
    initTerminal();
    initSearchPanel(); // Initialize search functionality

    initZenTimer(); // Initialize Zen timer

    // Add event listener for Enter key in chat input
    document.getElementById('chat-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessageToChatGPT();
        }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        // Mute/unmute ambient: Ctrl+Shift+M
        if (e.ctrlKey && e.shiftKey && e.key && e.key.toLowerCase() === 'm') {
            // ignore when typing in inputs or textareas
            const active = document.activeElement;
            const tag = active && active.tagName ? active.tagName.toLowerCase() : null;
            const isEditable = tag === 'input' || tag === 'textarea' || active.isContentEditable;
            if (!isEditable) {
                e.preventDefault();
                toggleAmbient();
                // small visual flash on the button to indicate action
                const btn = document.getElementById('zen-ambient-toggle');
                if (btn) {
                    btn.classList.add('flash');
                    setTimeout(() => btn.classList.remove('flash'), 300);
                }
            }
        }
    });

    // Welcome message in terminal
    addToTerminal('Welcome to Vibe Coding IDE', 'info');
    addToTerminal('Type Python code in the editor and click Run to execute', 'info');
    addToTerminal('', 'info');
});

// -----------------------
// Zen Timer Implementation
// -----------------------
const ZEN_KEY = 'vibe_zen_timer';
let zenState = {
    duration: 25 * 60, // seconds
    remaining: 25 * 60,
    running: false,
    endTime: null,
    intervalId: null
};

// ambient state will control ambient noise
zenState.ambient = false;
zenState.ambientVolume = 0.12;
let ambientNodes = {
    ctx: null,
    source: null,
    gain: null
};

function initZenTimer() {
    // Load saved state
    try {
        const raw = localStorage.getItem(ZEN_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            zenState.duration = parsed.duration || zenState.duration;
            zenState.remaining = parsed.remaining != null ? parsed.remaining : zenState.duration;
            zenState.running = parsed.running || false;
            zenState.endTime = parsed.endTime || null;
        }
        // If running, compute remaining from endTime
        if (zenState.running && zenState.endTime) {
            const delta = Math.floor((zenState.endTime - Date.now()) / 1000);
            zenState.remaining = Math.max(0, delta);
            if (zenState.remaining === 0) zenFinish();
            else startZenInterval();
        }
    } catch (e) {
        console.warn('Failed to load zen state', e);
    }
    initAmbient();
    updateZenUI();
}

function toggleZenTimer(forceOpen = null) {
    const panel = document.getElementById('zen-timer');
    const icon = document.getElementById('zen-icon');
    if (!panel) return;
    const isHidden = panel.style.display === 'none' || panel.classList.contains('hidden');
    const shouldOpen = forceOpen === true || (forceOpen === null && isHidden);
    if (shouldOpen) {
        panel.style.display = 'flex';
        panel.classList.remove('hidden');
        if (icon) icon.classList.add('active');
    } else {
        panel.classList.add('hidden');
        if (icon) icon.classList.remove('active');
        setTimeout(() => { panel.style.display = 'none'; }, 260);
    }
}

function setZenPreset(minutes) {
    zenState.duration = minutes * 60;
    zenState.remaining = zenState.duration;
    zenState.running = false;
    zenState.endTime = null;
    stopZenInterval();
    persistZen();
    updateZenUI();
}

function zenStartPause() {
    if (zenState.running) {
        // pause
        zenState.running = false;
        // compute remaining from endTime
        if (zenState.endTime) zenState.remaining = Math.max(0, Math.floor((zenState.endTime - Date.now()) / 1000));
        zenState.endTime = null;
        stopZenInterval();
    } else {
        // start
        zenState.running = true;
        if (!zenState.remaining || zenState.remaining <= 0) zenState.remaining = zenState.duration;
        zenState.endTime = Date.now() + zenState.remaining * 1000;
        startZenInterval();
    }
    persistZen();
    updateZenUI();
}

function zenReset() {
    zenState.remaining = zenState.duration;
    zenState.running = false;
    zenState.endTime = null;
    stopZenInterval();
    persistZen();
    updateZenUI();
}

function startZenInterval() {
    stopZenInterval();
    zenState.intervalId = setInterval(() => {
        const now = Date.now();
        const remain = Math.max(0, Math.ceil((zenState.endTime - now) / 1000));
        zenState.remaining = remain;
        if (zenState.remaining <= 0) {
            zenFinish();
        }
        updateZenUI();
    }, 250);
}

function stopZenInterval() {
    if (zenState.intervalId) {
        clearInterval(zenState.intervalId);
        zenState.intervalId = null;
    }
}

function zenFinish() {
    stopZenInterval();
    zenState.running = false;
    zenState.remaining = 0;
    zenState.endTime = null;
    persistZen();
    updateZenUI();
    playBell();
}

function updateZenUI() {
    const timeText = document.querySelector('.zen-time');
    const progress = document.querySelector('.zen-progress');
    const startBtn = document.getElementById('zen-start');
    if (!timeText || !progress || !startBtn) return;
    const mins = Math.floor(zenState.remaining / 60);
    const secs = zenState.remaining % 60;
    timeText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const pct = zenState.duration > 0 ? (zenState.remaining / zenState.duration) : 0;
    const offset = circumference * (1 - pct);
    progress.style.strokeDasharray = `${circumference}`;
    progress.style.strokeDashoffset = `${offset}`;
    startBtn.textContent = zenState.running ? 'Pause' : (zenState.remaining === 0 ? 'Done' : 'Start');
}

function persistZen() {
    try {
        const toSave = {
            duration: zenState.duration,
            remaining: zenState.remaining,
            running: zenState.running,
            endTime: zenState.endTime
        };
        localStorage.setItem(ZEN_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to persist zen state', e);
    }
}

// -----------------------
// Ambient noise (generated via WebAudio)
// -----------------------
function initAmbient() {
    // load ambient preference
    try {
        const raw = localStorage.getItem(ZEN_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.ambient != null) zenState.ambient = parsed.ambient;
            if (parsed.ambientVolume != null) zenState.ambientVolume = parsed.ambientVolume;
        }
    } catch (e) {
        // ignore
    }
    updateAmbientUI();

    // Initialize volume slider
    const volumeSlider = document.getElementById('zen-volume');
    if (volumeSlider) {
        volumeSlider.value = zenState.ambientVolume;
    }

    if (zenState.ambient) startAmbient();
}

function updateAmbientVolume(value) {
    zenState.ambientVolume = parseFloat(value);
    if (ambientNodes.gain) {
        ambientNodes.gain.gain.value = zenState.ambientVolume;
    }
    persistAmbient();
}

function toggleAmbient() {
    zenState.ambient = !zenState.ambient;
    if (zenState.ambient) startAmbient(); else stopAmbient();
    persistAmbient();
    updateAmbientUI();
}

function persistAmbient() {
    try {
        const raw = JSON.parse(localStorage.getItem(ZEN_KEY) || '{}');
        raw.ambient = zenState.ambient;
        raw.ambientVolume = zenState.ambientVolume;
        localStorage.setItem(ZEN_KEY, JSON.stringify(raw));
    } catch (e) {
        console.warn('Failed to persist ambient state', e);
    }
}

function updateAmbientUI() {
    const btn = document.getElementById('zen-ambient-toggle');
    if (btn) {
        btn.style.opacity = zenState.ambient ? '1' : '0.7';
        btn.style.borderColor = zenState.ambient ? 'var(--color-primary)' : '';
    }
}

function startAmbient() {
    if (ambientNodes.ctx) return; // already running
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const bufferSize = 2 * ctx.sampleRate; // two seconds
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        // fill with smooth noise (brownish)
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            data[i] = lastOut * 3.5 * 0.2;
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        const gain = ctx.createGain();
        gain.gain.value = zenState.ambientVolume;

        // gentle lowpass for smooth ambient
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;

        src.connect(lp);
        lp.connect(gain);
        gain.connect(ctx.destination);

        src.start(0);

        ambientNodes.ctx = ctx;
        ambientNodes.source = src;
        ambientNodes.gain = gain;
    } catch (e) {
        console.warn('Ambient start failed', e);
    }
}

function stopAmbient() {
    try {
        if (ambientNodes.source) {
            try { ambientNodes.source.stop(); } catch (e) { }
            ambientNodes.source.disconnect();
        }
        if (ambientNodes.gain) ambientNodes.gain.disconnect();
        if (ambientNodes.ctx) {
            try { ambientNodes.ctx.close(); } catch (e) { }
        }
    } catch (e) {
        console.warn('Ambient stop failed', e);
    }
    ambientNodes = { ctx: null, source: null, gain: null };
}

function playBell() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 880;
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(ctx.destination);
        const now = ctx.currentTime;
        g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
        o.start(now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        o.stop(now + 1.25);
    } catch (e) {
        console.warn('Bell sound failed', e);
    }
}

// Theme management functions
function getCurrentTheme() {
    return document.documentElement.getAttribute('data-color-scheme') || 'light';
}

function initializeTheme() {
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentTheme = savedTheme || systemTheme;

    console.log('Initializing theme:', currentTheme); // Debug log

    // Apply the theme
    applyTheme(currentTheme);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

function toggleTheme() {
    console.log('Toggle theme clicked!'); // Debug log
    const currentTheme = getCurrentTheme();

    // Cycle through light -> dark -> midnight -> light
    let newTheme;
    if (currentTheme === 'light') {
        newTheme = 'dark';
    } else if (currentTheme === 'dark') {
        newTheme = 'midnight';
    } else {
        newTheme = 'light';
    }

    console.log('Switching from', currentTheme, 'to', newTheme); // Debug log

    // Add transition class
    document.body.classList.add('theme-switching');

    // Apply new theme
    applyTheme(newTheme);

    // Save preference
    localStorage.setItem('theme', newTheme);

    // Remove transition class after animation
    setTimeout(() => {
        document.body.classList.remove('theme-switching');
    }, 500);

    // Show notification
    showNotification(`Switched to ${newTheme} mode`, 'success');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-color-scheme', theme);

    // Theme toggle icon logic: show sun in dark mode, moon in light mode
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    if (themeToggleIcon) {
        if (theme === 'dark') {
            // Show sun icon in dark mode (to indicate switch to light)
            themeToggleIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
            `;
        } else {
            // Show moon icon in light mode (to indicate switch to dark)
            themeToggleIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
                </svg>
            `;
        }
    }

    // Trigger Monaco editor theme update if editor exists
    if (typeof monaco !== 'undefined' && typeof monaco.editor !== 'undefined' && editor) {
        let editorTheme;
        // Ensure editor uses a dark theme when UI is blacked-out (including "light" if treated as black)
        if (theme === 'dark') {
            editorTheme = 'vibe-dark';
        } else if (theme === 'midnight') {
            editorTheme = 'vibe-midnight';
        } else {
            // Light mode
            editorTheme = 'vs-light';
        }
        console.log('Setting Monaco theme to:', editorTheme); // Debug log
        monaco.editor.setTheme(editorTheme);
    }
}

// Initialize Monaco Editor
function initMonacoEditor() {
    require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
    });

    require(['vs/editor/editor.main'], function () {
        // Configure Monaco theme
        monaco.editor.defineTheme('vibe-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: 'b3b3b3', fontStyle: 'italic' },
                { token: 'keyword', foreground: '1db954' },
                { token: 'string', foreground: 'ffa500' },
                { token: 'number', foreground: '87ceeb' },
                { token: 'function', foreground: 'dda0dd' },
            ],
            colors: {
                'editor.background': '#1a1a1a',
                'editor.foreground': '#ffffff',
                'editorLineNumber.foreground': '#b3b3b3',
                'editor.selectionBackground': '#1db95440',
                'editor.lineHighlightBackground': '#2d2d2d',
                'editorCursor.foreground': '#1db954',
                'editor.findMatchBackground': '#1db95440',
                'editor.findMatchHighlightBackground': '#1db95420'
            }
        });

        // Configure Monaco midnight theme (purple palette)
        monaco.editor.defineTheme('vibe-midnight', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '8b7bb8', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'a78bfa' },
                { token: 'string', foreground: 'c4b5fd' },
                { token: 'number', foreground: 'd8b4fe' },
                { token: 'function', foreground: 'e9d5ff' },
            ],
            colors: {
                'editor.background': '#0d0a14',
                'editor.foreground': '#e0d5f5',
                'editorLineNumber.foreground': '#6b5a8c',
                'editor.selectionBackground': '#a78bfa30',
                'editor.lineHighlightBackground': '#1a1225',
                'editorCursor.foreground': '#a78bfa',
                'editor.findMatchBackground': '#a78bfa40',
                'editor.findMatchHighlightBackground': '#a78bfa20'
            }
        });

        // Create the editor
        editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: `# Welcome to Vibe Coding IDE
# Write your Python code here and click Run to execute

def tail_fact(n, acc=1):
    if n == 0:
        return acc
    else:
        return tail_fact(n-1, acc * n)

def nontail_fact(n):
    if n == 0 or n == 1:
        return 1
    else:
        return n * nontail_fact(n-1)

# Example usage
print("Tail factorial of 5:", tail_fact(5))
print("Non-tail factorial of 5:", nontail_fact(5))

# Try asking ChatGPT for coding help in the right panel!`,
            language: 'python',
            theme: getCurrentTheme() === 'dark' ? 'vibe-dark' : 'vs-light',
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            bracketPairColorization: { enabled: true }
        });

        // Auto-resize editor when window resizes
        window.addEventListener('resize', function () {
            editor.layout();
        });

        // Initialize scope visualizer
        initScopeVisualizer();

        // Initialize linting
        initLinting();
    });
}

// -----------------------
// Linting Implementation
// -----------------------
let lintTimeout = null;

function initLinting() {
    if (!editor) return;

    editor.onDidChangeModelContent(() => {
        if (lintTimeout) clearTimeout(lintTimeout);
        lintTimeout = setTimeout(lintCode, 800); // Debounce 800ms
    });
}

function lintCode() {
    if (!editor) return;
    const code = editor.getValue();

    fetch('http://127.0.0.1:8000/lint/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: code })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const markers = data.errors.map(err => ({
                    severity: monaco.MarkerSeverity.Error,
                    startLineNumber: err.line,
                    startColumn: err.column || 1,
                    endLineNumber: err.line,
                    endColumn: err.endColumn || ((err.column || 1) + 100),
                    message: err.message,
                    source: 'Python Syntax'
                }));
                monaco.editor.setModelMarkers(editor.getModel(), 'python', markers);
            }
        })
        .catch(err => console.error('Linting error:', err));
}

// -----------------------
// Scope Visualizer Implementation
// -----------------------
let scopeDecorations = [];
let cursorChangeTimeout = null;

function initScopeVisualizer() {
    if (!editor) return;

    // Listen for cursor position changes
    editor.onDidChangeCursorPosition((e) => {
        // Debounce to avoid excessive parsing
        if (cursorChangeTimeout) {
            clearTimeout(cursorChangeTimeout);
        }

        cursorChangeTimeout = setTimeout(() => {
            updateScopeVisualization(e.position);
        }, 150);
    });
}

function updateScopeVisualization(position) {
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const code = model.getValue();
    const lineNumber = position.lineNumber;

    // Clear previous decorations
    scopeDecorations = editor.deltaDecorations(scopeDecorations, []);

    // Analyze code and get scope information
    const scopeInfo = analyzePythonScope(code, lineNumber);

    if (!scopeInfo) {
        // Cursor not in any scope
        return;
    }

    // Create decorations
    const decorations = [];

    // 1. Highlight block boundaries
    if (scopeInfo.blockRange) {
        decorations.push({
            range: new monaco.Range(
                scopeInfo.blockRange.startLine,
                1,
                scopeInfo.blockRange.endLine,
                model.getLineMaxColumn(scopeInfo.blockRange.endLine)
            ),
            options: {
                isWholeLine: false,
                className: 'scope-block-highlight',
                glyphMarginClassName: 'scope-block-glyph',
                inlineClassName: 'scope-block-inline'
            }
        });

        // Add border decoration for the block
        decorations.push({
            range: new monaco.Range(
                scopeInfo.blockRange.startLine,
                1,
                scopeInfo.blockRange.endLine,
                1
            ),
            options: {
                isWholeLine: true,
                linesDecorationsClassName: 'scope-block-border'
            }
        });
    }

    // 2. Highlight local variables
    scopeInfo.localVars.forEach(varInfo => {
        varInfo.ranges.forEach(range => {
            decorations.push({
                range: new monaco.Range(
                    range.startLine,
                    range.startColumn,
                    range.endLine,
                    range.endColumn
                ),
                options: {
                    inlineClassName: 'scope-local-var'
                }
            });
        });
    });

    // 3. Highlight global/parent scope variables
    scopeInfo.globalVars.forEach(varInfo => {
        varInfo.ranges.forEach(range => {
            decorations.push({
                range: new monaco.Range(
                    range.startLine,
                    range.startColumn,
                    range.endLine,
                    range.endColumn
                ),
                options: {
                    inlineClassName: 'scope-global-var'
                }
            });
        });
    });

    // Apply decorations
    scopeDecorations = editor.deltaDecorations([], decorations);
}

function analyzePythonScope(code, cursorLine) {
    const lines = code.split('\n');

    // Find which block the cursor is in
    const blockInfo = findCurrentBlock(lines, cursorLine);

    if (!blockInfo) {
        return null;
    }

    // Extract variables in the current scope
    const localVars = extractLocalVariables(lines, blockInfo);
    const globalVars = extractGlobalVariables(lines, blockInfo, localVars);

    return {
        blockRange: blockInfo.range,
        localVars: localVars,
        globalVars: globalVars
    };
}

function findCurrentBlock(lines, cursorLine) {
    // Find function or loop definitions
    const blockPatterns = [
        { type: 'function', regex: /^(\s*)def\s+\w+\s*\(.*\)\s*:/ },
        { type: 'for', regex: /^(\s*)for\s+.+\s+in\s+.+:/ },
        { type: 'while', regex: /^(\s*)while\s+.+:/ },
        { type: 'if', regex: /^(\s*)if\s+.+:/ },
        { type: 'elif', regex: /^(\s*)elif\s+.+:/ },
        { type: 'else', regex: /^(\s*)else\s*:/ },
        { type: 'with', regex: /^(\s*)with\s+.+:/ },
        { type: 'try', regex: /^(\s*)try\s*:/ },
        { type: 'except', regex: /^(\s*)except.*:/ }
    ];

    let currentBlock = null;

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        for (const pattern of blockPatterns) {
            const match = line.match(pattern.regex);
            if (match) {
                const indent = match[1].length;
                const blockEnd = findBlockEnd(lines, i, indent);

                // Check if cursor is within this block
                if (cursorLine > lineNum && cursorLine <= blockEnd) {
                    // This is a potential block, but check for nested blocks
                    const nestedBlock = findNestedBlock(lines, lineNum, blockEnd, cursorLine, indent);
                    if (nestedBlock) {
                        currentBlock = nestedBlock;
                    } else {
                        currentBlock = {
                            type: pattern.type,
                            range: {
                                startLine: lineNum,
                                endLine: blockEnd
                            },
                            indent: indent,
                            defLine: lineNum
                        };
                    }
                }
            }
        }
    }

    return currentBlock;
}

function findNestedBlock(lines, startLine, endLine, cursorLine, parentIndent) {
    const blockPatterns = [
        { type: 'function', regex: /^(\s*)def\s+\w+\s*\(.*\)\s*:/ },
        { type: 'for', regex: /^(\s*)for\s+.+\s+in\s+.+:/ },
        { type: 'while', regex: /^(\s*)while\s+.+:/ },
        { type: 'if', regex: /^(\s*)if\s+.+:/ },
        { type: 'elif', regex: /^(\s*)elif\s+.+:/ },
        { type: 'else', regex: /^(\s*)else\s*:/ }
    ];

    for (let i = startLine; i < endLine; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        for (const pattern of blockPatterns) {
            const match = line.match(pattern.regex);
            if (match) {
                const indent = match[1].length;
                // Must be more indented than parent
                if (indent > parentIndent) {
                    const blockEnd = findBlockEnd(lines, i, indent);

                    if (cursorLine > lineNum && cursorLine <= blockEnd) {
                        // Recursively check for even deeper nesting
                        const deeperNested = findNestedBlock(lines, lineNum, blockEnd, cursorLine, indent);
                        return deeperNested || {
                            type: pattern.type,
                            range: {
                                startLine: lineNum,
                                endLine: blockEnd
                            },
                            indent: indent,
                            defLine: lineNum
                        };
                    }
                }
            }
        }
    }

    return null;
}

function findBlockEnd(lines, startIdx, blockIndent) {
    for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines and comments
        if (line.trim() === '' || line.trim().startsWith('#')) {
            continue;
        }

        // Calculate indent
        const match = line.match(/^(\s*)/);
        const lineIndent = match ? match[1].length : 0;

        // If we find a line with same or less indent, block ends
        if (lineIndent <= blockIndent) {
            return i; // Return line number (0-indexed to 1-indexed conversion happens in caller)
        }
    }

    return lines.length;
}

function extractLocalVariables(lines, blockInfo) {
    const localVars = {};
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

    // Patterns that define local variables
    const assignmentPattern = /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*=/;
    const forPattern = /^(\s*)for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+/;
    const funcDefPattern = /^(\s*)def\s+\w+\s*\(([^)]*)\)/;

    for (let i = blockInfo.range.startLine - 1; i < blockInfo.range.endLine; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Check for assignments
        const assignMatch = line.match(assignmentPattern);
        if (assignMatch) {
            const varName = assignMatch[2];
            if (!localVars[varName]) {
                localVars[varName] = { ranges: [] };
            }
        }

        // Check for loop variables
        const forMatch = line.match(forPattern);
        if (forMatch) {
            const varName = forMatch[2];
            if (!localVars[varName]) {
                localVars[varName] = { ranges: [] };
            }
        }

        // Check for function parameters
        if (lineNum === blockInfo.defLine && blockInfo.type === 'function') {
            const funcMatch = line.match(funcDefPattern);
            if (funcMatch) {
                const params = funcMatch[2].split(',').map(p => p.trim().split('=')[0].trim());
                params.forEach(param => {
                    if (param && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param)) {
                        if (!localVars[param]) {
                            localVars[param] = { ranges: [] };
                        }
                    }
                });
            }
        }
    }

    // Now find all occurrences of local variables
    Object.keys(localVars).forEach(varName => {
        for (let i = blockInfo.range.startLine - 1; i < blockInfo.range.endLine; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            // Find all occurrences in this line
            const regex = new RegExp(`\\b${varName}\\b`, 'g');
            let match;
            while ((match = regex.exec(line)) !== null) {
                localVars[varName].ranges.push({
                    startLine: lineNum,
                    startColumn: match.index + 1,
                    endLine: lineNum,
                    endColumn: match.index + 1 + varName.length
                });
            }
        }
    });

    return Object.keys(localVars).map(name => ({
        name: name,
        ranges: localVars[name].ranges
    }));
}

function extractGlobalVariables(lines, blockInfo, localVars) {
    const globalVars = {};
    const localVarNames = new Set(localVars.map(v => v.name));
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

    // Scan the block for variable usage
    for (let i = blockInfo.range.startLine - 1; i < blockInfo.range.endLine; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        let match;
        while ((match = varPattern.exec(line)) !== null) {
            const varName = match[1];

            // Skip if it's a local variable or a Python keyword
            if (localVarNames.has(varName) || isPythonKeyword(varName)) {
                continue;
            }

            if (!globalVars[varName]) {
                globalVars[varName] = { ranges: [] };
            }

            globalVars[varName].ranges.push({
                startLine: lineNum,
                startColumn: match.index + 1,
                endLine: lineNum,
                endColumn: match.index + 1 + varName.length
            });
        }
    }

    return Object.keys(globalVars).map(name => ({
        name: name,
        ranges: globalVars[name].ranges
    }));
}

function isPythonKeyword(word) {
    const keywords = [
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
        'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
        'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
        'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
        'try', 'while', 'with', 'yield', 'print', 'range', 'len', 'str',
        'int', 'float', 'list', 'dict', 'set', 'tuple', 'bool'
    ];
    return keywords.includes(word);
}

// Initialize Search Panel
function initSearchPanel() {
    const searchInput = document.getElementById('search-input');
    const replaceInput = document.getElementById('replace-input');

    if (!searchInput || !replaceInput) {
        console.warn('Search panel elements not found');
        return;
    }

    // Search input event listeners
    searchInput.addEventListener('input', function () {
        performSearch();
    });

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            findNext();
        } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            findPrevious();
        }
    });

    // Replace input event listeners
    replaceInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            replaceOne();
        }
    });

    // Option checkboxes
    const matchCase = document.getElementById('match-case');
    const matchWholeWord = document.getElementById('match-whole-word');
    const useRegex = document.getElementById('use-regex');

    if (matchCase) matchCase.addEventListener('change', performSearch);
    if (matchWholeWord) matchWholeWord.addEventListener('change', performSearch);
    if (useRegex) useRegex.addEventListener('change', performSearch);
}

// Toggle Search Panel
function toggleSearchPanel(forceOpen = null) {
    const panel = document.getElementById('search-panel');
    const searchIcon = document.getElementById('search-icon');

    if (forceOpen === true || (forceOpen === null && panel.style.display === 'none')) {
        panel.style.display = 'block';
        searchIcon.classList.add('active');
        setTimeout(() => {
            document.getElementById('search-input').focus();
        }, 100);

        // If there's selected text in editor, use it as search term
        if (editor && editor.getSelection && !editor.getSelection().isEmpty()) {
            const selectedText = editor.getModel().getValueInRange(editor.getSelection());
            document.getElementById('search-input').value = selectedText;
            performSearch();
        }
    } else {
        panel.style.display = 'none';
        searchIcon.classList.remove('active');
        clearSearchHighlights();
    }
}

// Toggle Replace Mode
function toggleReplaceMode(forceOpen = null) {
    const replaceSection = document.getElementById('replace-section');
    const toggleButton = document.getElementById('toggle-replace');
    const arrow = toggleButton.querySelector('svg');

    if (forceOpen === true || (forceOpen === null && replaceSection.style.display === 'none')) {
        replaceSection.style.display = 'block';
        arrow.style.transform = 'rotate(90deg)';
        isReplaceMode = true;
    } else {
        replaceSection.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
        isReplaceMode = false;
    }
}

// Perform Search
function performSearch() {
    if (!editor) return;

    const searchTerm = document.getElementById('search-input').value;
    if (!searchTerm) {
        clearSearchHighlights();
        updateSearchResults(0, 0);
        return;
    }

    const matchCase = document.getElementById('match-case').checked;
    const wholeWord = document.getElementById('match-whole-word').checked;
    const useRegex = document.getElementById('use-regex').checked;

    try {
        const model = editor.getModel();
        let flags = 'g';
        if (!matchCase) flags += 'i';

        let searchPattern;
        if (useRegex) {
            searchPattern = new RegExp(searchTerm, flags);
        } else {
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = wholeWord ? `\\b${escapedTerm}\\b` : escapedTerm;
            searchPattern = new RegExp(pattern, flags);
        }

        // Find all matches
        const content = model.getValue();
        const matches = [];
        let match;

        while ((match = searchPattern.exec(content)) !== null) {
            const startPos = model.getPositionAt(match.index);
            const endPos = model.getPositionAt(match.index + match[0].length);
            matches.push({
                range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
                text: match[0]
            });

            // Prevent infinite loop for zero-length matches
            if (match[0].length === 0) {
                searchPattern.lastIndex++;
            }
        }

        // Highlight matches
        highlightMatches(matches);
        updateSearchResults(matches.length, 0);

        // Focus first match if exists
        if (matches.length > 0) {
            editor.setSelection(matches[0].range);
            editor.revealRangeInCenter(matches[0].range);
        }

    } catch (error) {
        console.error('Search error:', error);
        updateSearchResults(0, 0);
    }
}

// Highlight Matches
function highlightMatches(matches) {
    if (!editor) return;

    // Clear previous decorations
    clearSearchHighlights();

    if (matches.length === 0) return;

    // Create decorations for matches
    const decorations = matches.map(match => ({
        range: match.range,
        options: {
            className: 'search-highlight',
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
    }));

    // Apply decorations
    searchWidget = editor.deltaDecorations([], decorations);
}

// -----------------------
// Notes panel functionality
// -----------------------
const NOTES_KEY = 'vibe_session_notes';
let notesAutoSaveTimer = null;
const NOTES_AUTOSAVE_DELAY = 750; // ms

function toggleNotesPanel(forceOpen = null) {
    const panel = document.getElementById('notes-panel');
    const icon = document.getElementById('notes-icon');
    if (!panel) return;

    const isHidden = panel.style.display === 'none' || panel.classList.contains('hidden');
    const shouldOpen = forceOpen === true || (forceOpen === null && isHidden);

    if (shouldOpen) {
        loadNotes();
        panel.style.display = 'flex';
        panel.classList.remove('hidden');
        if (icon) icon.classList.add('active');
        setTimeout(() => document.getElementById('notes-textarea').focus(), 120);
    } else {
        panel.classList.add('hidden');
        if (icon) icon.classList.remove('active');
        // allow animation then hide
        setTimeout(() => { panel.style.display = 'none'; }, 260);
    }
}

function closeNotesPanel() {
    toggleNotesPanel(false);
}

function loadNotes() {
    const textarea = document.getElementById('notes-textarea');
    if (!textarea) return;
    const existing = localStorage.getItem(NOTES_KEY) || '';
    textarea.value = existing;
    updateNotesStatus('Loaded locally');

    // attach input listener for autosave
    textarea.removeEventListener('input', onNotesInput);
    textarea.addEventListener('input', onNotesInput);
}

function onNotesInput() {
    updateNotesStatus('Unsaved changes...');
    if (notesAutoSaveTimer) clearTimeout(notesAutoSaveTimer);
    notesAutoSaveTimer = setTimeout(() => {
        saveNotes();
    }, NOTES_AUTOSAVE_DELAY);
}

function saveNotes() {
    const textarea = document.getElementById('notes-textarea');
    if (!textarea) return;
    try {
        localStorage.setItem(NOTES_KEY, textarea.value);
        updateNotesStatus('Saved locally • ' + new Date().toLocaleTimeString());
    } catch (e) {
        console.error('Failed to save notes:', e);
        updateNotesStatus('Save failed');
    }
}

function clearNotes() {
    const confirmed = confirm('Clear all notes for this session? This cannot be undone.');
    if (!confirmed) return;
    const textarea = document.getElementById('notes-textarea');
    if (!textarea) return;
    textarea.value = '';
    saveNotes();
}

function updateNotesStatus(text) {
    const status = document.getElementById('notes-status');
    if (status) status.textContent = text;
}

function downloadNotes() {
    const textarea = document.getElementById('notes-textarea');
    if (!textarea || !textarea.value.trim()) {
        showNotification('No notes to download', 'warning');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vibe_notes_${timestamp}.txt`;
    const content = textarea.value;

    downloadFile(filename, content);
    showNotification('Notes downloaded', 'success');
}

function downloadTranscript() {
    const terminalOutput = document.getElementById('terminal-output');
    if (!terminalOutput) return;

    let content = '';
    // Iterate over terminal lines to construct the transcript
    const lines = terminalOutput.querySelectorAll('.terminal-line');
    if (lines.length === 0) {
        showNotification('No transcript to download', 'warning');
        return;
    }

    lines.forEach(line => {
        let lineText = line.textContent;
        if (line.classList.contains('command')) {
            content += `> ${lineText}\n`;
        } else if (line.classList.contains('error')) {
            content += `[ERROR] ${lineText}\n`;
        } else if (line.classList.contains('warning')) {
            content += `[WARNING] ${lineText}\n`;
        } else if (line.classList.contains('info')) {
            content += `[INFO] ${lineText}\n`;
        } else {
            content += `${lineText}\n`;
        }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vibe_transcript_${timestamp}.txt`;

    downloadFile(filename, content);
    showNotification('Transcript downloaded', 'success');
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Ensure notes panel is closed on load
document.addEventListener('DOMContentLoaded', function () {
    const panel = document.getElementById('notes-panel');
    if (panel) panel.style.display = 'none';
});

// Clear Search Highlights
function clearSearchHighlights() {
    if (!editor || !searchWidget) return;

    editor.deltaDecorations(searchWidget, []);
    searchWidget = null;
}

// Update Search Results
function updateSearchResults(totalMatches, currentMatch) {
    const resultsDiv = document.getElementById('search-results');
    if (totalMatches === 0) {
        resultsDiv.textContent = 'No results';
        resultsDiv.className = 'search-results no-results';
    } else {
        resultsDiv.textContent = `${currentMatch + 1} of ${totalMatches}`;
        resultsDiv.className = 'search-results has-results';
    }
}

// Find Next Match
function findNext() {
    if (!editor) return;

    const searchTerm = document.getElementById('search-input').value;
    if (!searchTerm) return;

    const position = editor.getPosition();
    const model = editor.getModel();

    const matchCase = document.getElementById('match-case').checked;
    const wholeWord = document.getElementById('match-whole-word').checked;
    const useRegex = document.getElementById('use-regex').checked;

    const nextMatch = model.findNextMatch(searchTerm, position, useRegex, matchCase, wholeWord, false);

    if (nextMatch) {
        editor.setSelection(nextMatch.range);
        editor.revealRangeInCenter(nextMatch.range);
    } else {
        // Wrap to beginning
        const firstMatch = model.findNextMatch(searchTerm, { lineNumber: 1, column: 1 }, useRegex, matchCase, wholeWord, false);
        if (firstMatch) {
            editor.setSelection(firstMatch.range);
            editor.revealRangeInCenter(firstMatch.range);
            showNotification('Wrapped to beginning of file', 'info');
        }
    }
}

// Find Previous Match
function findPrevious() {
    if (!editor) return;

    const searchTerm = document.getElementById('search-input').value;
    if (!searchTerm) return;

    const position = editor.getPosition();
    const model = editor.getModel();

    const matchCase = document.getElementById('match-case').checked;
    const wholeWord = document.getElementById('match-whole-word').checked;
    const useRegex = document.getElementById('use-regex').checked;

    const prevMatch = model.findPreviousMatch(searchTerm, position, useRegex, matchCase, wholeWord, false);

    if (prevMatch) {
        editor.setSelection(prevMatch.range);
        editor.revealRangeInCenter(prevMatch.range);
    } else {
        // Wrap to end
        const lineCount = model.getLineCount();
        const lastLineLength = model.getLineLength(lineCount);
        const lastMatch = model.findPreviousMatch(searchTerm, { lineNumber: lineCount, column: lastLineLength + 1 }, useRegex, matchCase, wholeWord, false);
        if (lastMatch) {
            editor.setSelection(lastMatch.range);
            editor.revealRangeInCenter(lastMatch.range);
            showNotification('Wrapped to end of file', 'info');
        }
    }
}

// Replace One Match
function replaceOne() {
    if (!editor) return;

    const replaceText = document.getElementById('replace-input').value;
    const selection = editor.getSelection();

    if (!selection.isEmpty()) {
        editor.executeEdits('replace', [{
            range: selection,
            text: replaceText
        }]);
        findNext(); // Move to next match
        showNotification('Replaced 1 occurrence', 'success');
    }
}

// Replace All Matches
function replaceAll() {
    if (!editor) return;

    const searchTerm = document.getElementById('search-input').value;
    const replaceText = document.getElementById('replace-input').value;

    if (!searchTerm) return;

    const matchCase = document.getElementById('match-case').checked;
    const wholeWord = document.getElementById('match-whole-word').checked;
    const useRegex = document.getElementById('use-regex').checked;

    try {
        const model = editor.getModel();
        let flags = 'g';
        if (!matchCase) flags += 'i';

        let searchPattern;
        if (useRegex) {
            searchPattern = new RegExp(searchTerm, flags);
        } else {
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = wholeWord ? `\\b${escapedTerm}\\b` : escapedTerm;
            searchPattern = new RegExp(pattern, flags);
        }

        const content = model.getValue();
        const newContent = content.replace(searchPattern, replaceText);
        const replacedCount = (content.match(searchPattern) || []).length;

        if (replacedCount > 0) {
            editor.setValue(newContent);
            showNotification(`Replaced ${replacedCount} occurrence(s)`, 'success');
            clearSearchHighlights();
        } else {
            showNotification('No matches found to replace', 'warning');
        }

    } catch (error) {
        console.error('Replace error:', error);
        showNotification('Replace failed: Invalid regex pattern', 'error');
    }
}

// Add keyboard shortcuts for search
document.addEventListener('keydown', function (e) {
    // Ctrl+F or Cmd+F to open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearchPanel(true);
    }
    // F3 for next match
    if (e.key === 'F3' && !e.shiftKey) {
        e.preventDefault();
        findNext();
    }
    // Shift+F3 for previous match
    if (e.key === 'F3' && e.shiftKey) {
        e.preventDefault();
        findPrevious();
    }
    // Escape to close search
    if (e.key === 'Escape' && document.getElementById('search-panel').style.display !== 'none') {
        toggleSearchPanel(false);
    }
    // Ctrl+H or Cmd+H for replace
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        toggleSearchPanel(true);
        toggleReplaceMode(true);
    }
    // Ctrl+Shift+Right: Increase editor width
    if (e.ctrlKey && e.shiftKey && e.key === 'ArrowRight') {
        adjustPanelSizes('increase');
        e.preventDefault();
    }
    // Ctrl+Shift+Left: Decrease editor width
    if (e.ctrlKey && e.shiftKey && e.key === 'ArrowLeft') {
        adjustPanelSizes('decrease');
        e.preventDefault();
    }
});

// Initialize resizers for split panels
function initResizers() {
    const verticalResizer = document.querySelector('.vertical-resizer');
    const terminalResizer = document.querySelector('.terminal-resizer');

    // Vertical resizer (between editor and chat)
    verticalResizer.addEventListener('mousedown', function (e) {
        isResizing = true;
        currentResizeType = 'vertical';

        // Add visual feedback
        document.body.classList.add('resizing');
        document.querySelector('.split-container').classList.add('resizing');

        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    });

    // Terminal resizer
    terminalResizer.addEventListener('mousedown', function (e) {
        isResizing = true;
        currentResizeType = 'terminal';
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    });
}

// Handle resize events
function handleResize(e) {
    if (!isResizing) return;

    if (currentResizeType === 'vertical') {
        const container = document.querySelector('.split-container');
        const rect = container.getBoundingClientRect();
        const percentage = ((e.clientX - rect.left) / rect.width) * 100;

        // Improved constraints - allow more flexibility
        if (percentage >= 20 && percentage <= 80) {
            const editorPanel = document.querySelector('.editor-panel');
            const chatPanel = document.querySelector('.chat-panel');

            // Apply new widths
            editorPanel.style.flex = `0 0 ${percentage}%`;
            chatPanel.style.flex = `0 0 ${100 - percentage}%`;

            // Store the current percentage for smooth resizing
            container.dataset.editorWidth = percentage;
        }
    } else if (currentResizeType === 'terminal') {
        const mainContent = document.querySelector('.main-content');
        const rect = mainContent.getBoundingClientRect();
        const terminalHeight = rect.bottom - e.clientY;
        const percentage = (terminalHeight / rect.height) * 100;

        if (percentage > 15 && percentage < 50) {
            document.querySelector('.terminal-container').style.height = `${percentage}%`;
            document.querySelector('.split-container').style.height = `${100 - percentage}%`;
        }
    }

    // Trigger editor layout update
    if (editor) {
        setTimeout(() => editor.layout(), 0);
    }
}

// Stop resize
function stopResize() {
    isResizing = false;
    currentResizeType = null;

    // Remove visual feedback
    document.body.classList.remove('resizing');
    document.querySelector('.split-container').classList.remove('resizing');

    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);

    // Trigger editor layout update after resize is complete
    if (editor) {
        setTimeout(() => editor.layout(), 100);
    }
}

// Initialize terminal
function initTerminal() {
    const terminalOutput = document.getElementById('terminal-output');
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Run Python code - IMPROVED VERSION
// REPLACE your existing runPythonCode function with this one
function runPythonCode() {
    if (!editor) {
        addToTerminal('Editor not initialized', 'error');
        return;
    }

    const code = editor.getValue();
    if (!code.trim()) {
        addToTerminal('No code to execute', 'warning');
        return;
    }

    // Generate a unique session ID
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Code being sent:', JSON.stringify(code));
    addToTerminal('Executing code...', 'info');

    fetch('http://127.0.0.1:8000/execute/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            session_id: currentSessionId
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Response received:', data);
            handleExecutionResponse(data);
        })
        .catch(error => {
            console.error('Connection error:', error);
            addToTerminal('Connection error: ' + error.message, 'error');
            currentSessionId = null;
        });
}

// ADD this new function
function handleExecutionResponse(data) {
    if (data.success) {
        if (data.needs_input) {
            // Code is waiting for input
            isWaitingForInput = true;
            currentSessionId = data.session_id;

            // Show any output so far
            if (data.output) {
                addToTerminal(data.output, 'output');
            }

            // Show input prompt and create input interface
            const prompt = data.input_prompt || "Enter input:";
            addToTerminal(prompt, 'info');
            createInputInterface();

        } else if (data.running) {
            // Code is still running, check status periodically
            currentSessionId = data.session_id;

            // Show any output so far
            if (data.output) {
                addToTerminal(data.output, 'output');
            }

            // Check status again after a short delay
            setTimeout(() => checkExecutionStatus(currentSessionId), 1000);

        } else if (data.completed || data.output !== undefined) {
            // Execution completed
            if (data.output) {
                addToTerminal(data.output, 'output');
            } else {
                addToTerminal('Code executed successfully (no output)', 'success');
            }
            currentSessionId = null;
            isWaitingForInput = false;
        }
    } else {
        // Execution failed
        addToTerminal('Error: ' + data.error, 'error');
        currentSessionId = null;
        isWaitingForInput = false;
    }
}

// ADD this new function
function checkExecutionStatus(sessionId) {
    if (!sessionId || sessionId !== currentSessionId) {
        return; // Session changed or cleared
    }

    fetch('http://127.0.0.1:8000/check_status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: sessionId })
    })
        .then(response => response.json())
        .then(data => {
            handleExecutionResponse(data);
        })
        .catch(error => {
            console.error('Status check error:', error);
            addToTerminal('Status check error: ' + error.message, 'error');
            currentSessionId = null;
            isWaitingForInput = false;
        });
}

// ADD this new function
function createInputInterface() {
    const terminalOutput = document.getElementById('terminal-output');

    // Create input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'terminal-input-container';
    inputContainer.style.cssText = `
        display: flex;
        align-items: center;
        margin-top: 8px;
        padding: 8px 0;
        border-top: 1px solid var(--color-border);
        background-color: rgba(var(--color-primary-rgb, 33, 128, 141), 0.1);
    `;

    // Create input prompt
    const inputPrompt = document.createElement('span');
    inputPrompt.textContent = '>>> ';
    inputPrompt.style.cssText = `
        color: var(--color-primary);
        font-family: var(--font-family-mono);
        margin-right: 8px;
        flex-shrink: 0;
        font-weight: bold;
    `;

    // Create input field
    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'terminal-user-input';
    inputField.style.cssText = `
        flex: 1;
        background: transparent;
        border: none;
        color: orange; /* <-- Set user input text to orange */
        font-family: var(--font-family-mono);
        font-size: var(--font-size-sm);
        outline: none;
        padding: 4px;
    `;
    inputField.placeholder = 'Type your input and press Enter...';

    // Handle input submission
    inputField.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            const userInput = inputField.value;

            // Show the input in terminal
            addToTerminal('>>> ' + userInput, 'command');

            // Remove input interface
            inputContainer.remove();

            // Send input to backend
            sendInputToBackend(userInput);
        }
    });

    // Add elements to container
    inputContainer.appendChild(inputPrompt);
    inputContainer.appendChild(inputField);

    // Add to terminal and focus
    terminalOutput.appendChild(inputContainer);
    inputField.focus();

    // Scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// ADD this new function
function sendInputToBackend(userInput) {
    if (!currentSessionId) {
        addToTerminal('Error: No active session', 'error');
        return;
    }

    fetch('http://127.0.0.1:8000/provide_input', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            session_id: currentSessionId,
            input: userInput
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Input sent successfully, continue checking status
                isWaitingForInput = false;
                setTimeout(() => checkExecutionStatus(currentSessionId), 500);
            } else {
                addToTerminal('Input error: ' + data.error, 'error');
                currentSessionId = null;
                isWaitingForInput = false;
            }
        })
        .catch(error => {
            console.error('Input send error:', error);
            addToTerminal('Failed to send input: ' + error.message, 'error');
            currentSessionId = null;
            isWaitingForInput = false;
        });
}
// Send message to ChatGPT
function sendMessageToChatGPT() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Add user message to chat
    addChatMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    addChatMessage('ChatGPT is typing...', 'system');

    fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: message })
    })
        .then(response => response.json())
        .then(data => {
            // Remove typing indicator
            const chatMessages = document.getElementById('chat-messages');
            const lastMessage = chatMessages.lastElementChild;
            if (lastMessage && lastMessage.classList.contains('system-message')) {
                lastMessage.remove();
            }

            if (data.success) {
                addChatMessage(data.reply, 'assistant');

                // Highlight copy button if code was detected
                if (data.reply.includes('```')) {
                    highlightCopyButton();
                }
            } else {
                addChatMessage('Error: ' + data.error, 'error');
            }
        })
        .catch(error => {
            // Remove typing indicator
            const chatMessages = document.getElementById('chat-messages');
            const lastMessage = chatMessages.lastElementChild;
            if (lastMessage && lastMessage.classList.contains('system-message')) {
                lastMessage.remove();
            }
            addChatMessage('Connection error: ' + error.message, 'error');
        });
}

// FIXED: Add message to chat panel with improved code block rendering
function addChatMessage(message, type) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;

    // IMPROVED: Better regex for code block detection that handles multiline code properly
    let formattedMessage = message;

    // Replace code blocks with proper HTML structure
    formattedMessage = formattedMessage.replace(/```([\s\S]*?)```/g, function (match, code) {
        // Clean up the code - remove extra whitespace but preserve formatting
        const cleanCode = code.trim();
        return `<div class="code-block-wrapper"><pre class="code-block"><code>${escapeHtml(cleanCode)}</code></pre></div>`;
    });

    // Replace inline code
    formattedMessage = formattedMessage.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    messageDiv.innerHTML = formattedMessage;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Highlight copy button when code is available
function highlightCopyButton() {
    const copyIcon = document.getElementById('copy-code-icon');
    if (copyIcon) {
        // Add visual indicator that code is available
        copyIcon.style.background = 'rgba(34, 197, 94, 0.2)';
        copyIcon.style.color = '#22c55e';

        // Remove highlight after 5 seconds
        setTimeout(() => {
            copyIcon.style.background = '';
            copyIcon.style.color = '';
        }, 5000);
    }
}

// FIXED: Enhanced function to copy code from the latest assistant message
function copyLatestCode() {
    console.log('Copy button clicked!'); // Debug log
    const copyIcon = document.getElementById('copy-code-icon');
    if (!copyIcon) {
        console.error('Copy icon not found!');
        return;
    }

    const originalIconSVG = copyIcon.innerHTML; // Save the original icon + label

    // 1. Find the latest assistant message
    const allAssistantMessages = document.querySelectorAll('.assistant-message');
    console.log('Found assistant messages:', allAssistantMessages.length); // Debug log

    if (allAssistantMessages.length === 0) {
        showNotification('No ChatGPT replies found to copy from.', 'warning');
        return;
    }

    const latestMessage = allAssistantMessages[allAssistantMessages.length - 1];
    console.log('Latest message:', latestMessage); // Debug log

    // 2. Find code blocks within that message - try multiple selectors
    let codeBlock = latestMessage.querySelector('pre code');
    if (!codeBlock) {
        codeBlock = latestMessage.querySelector('.code-block code');
    }
    if (!codeBlock) {
        codeBlock = latestMessage.querySelector('pre');
    }
    if (!codeBlock) {
        // Try to find any code-like content
        codeBlock = latestMessage.querySelector('code');
    }

    console.log('Code block found:', codeBlock); // Debug log

    if (!codeBlock) {
        showNotification('No code block found in the latest ChatGPT reply.', 'warning');
        return;
    }

    // 3. Get the code text and write to clipboard
    const codeToCopy = codeBlock.textContent || codeBlock.innerText;
    console.log('Code to copy:', codeToCopy); // Debug log

    if (!codeToCopy.trim()) {
        showNotification('Code block is empty.', 'warning');
        return;
    }

    // Use the clipboard API
    if (navigator.clipboard) {
        navigator.clipboard.writeText(codeToCopy).then(() => {
            // Success feedback
            copyIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <div class="sidebar-label">Copied!</div>
            `;
            copyIcon.classList.add('copied');

            // Show success notification
            showNotification('Code copied to clipboard successfully!', 'success');

            // Ask user if they want to replace editor content
            setTimeout(() => {
                if (confirm('Would you like to replace the current editor content with the copied code?')) {
                    if (editor) {
                        editor.setValue(codeToCopy);
                        showNotification('Code added to editor!', 'success');
                    }
                }
            }, 500);

            // Revert back to original icon after 3 seconds
            setTimeout(() => {
                copyIcon.innerHTML = originalIconSVG;
                copyIcon.classList.remove('copied');
            }, 3000);
        }).catch(err => {
            console.error('Clipboard write failed:', err);
            // Fallback method
            fallbackCopyTextToClipboard(codeToCopy, copyIcon, originalIconSVG);
        });
    } else {
        // Fallback for browsers without clipboard API
        fallbackCopyTextToClipboard(codeToCopy, copyIcon, originalIconSVG);
    }
}

// Fallback copy method for older browsers
function fallbackCopyTextToClipboard(text, copyIcon, originalIconSVG) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            copyIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <div class="sidebar-label">Copied!</div>
            `;
            copyIcon.classList.add('copied');
            showNotification('Code copied to clipboard!', 'success');

            setTimeout(() => {
                copyIcon.innerHTML = originalIconSVG;
                copyIcon.classList.remove('copied');
            }, 3000);
        } else {
            throw new Error('Copy command failed');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showNotification('Failed to copy code. Please copy manually.', 'error');
    }

    document.body.removeChild(textArea);
}

// Simple notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#22c55e';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }

    notification.innerHTML = `${message}`;
    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 4000);
}

// Add message to terminal
function addToTerminal(message, type = 'output') {
    const terminalOutput = document.getElementById('terminal-output');
    const messageDiv = document.createElement('div');
    messageDiv.className = `terminal-line ${type}`;
    messageDiv.textContent = message;
    terminalOutput.appendChild(messageDiv);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Handle terminal input
function handleTerminalInput(event) {
    if (event.key === 'Enter') {
        const input = document.getElementById('terminal-input');
        const command = input.value.trim();

        if (command) {
            addToTerminal('$ ' + command, 'command');

            if (command.startsWith('pip install ')) {
                const package = command.substring(12);
                addToTerminal(`Installing ${package}...`, 'info');
                addToTerminal(`Package ${package} installed successfully`, 'success');
            } else if (command === 'clear') {
                clearTerminal();
            } else {
                addToTerminal(`Command '${command}' not recognized`, 'warning');
            }
        }

        input.value = '';
    }
}

// Clear terminal
function clearTerminal() {
    const terminalOutput = document.getElementById('terminal-output');
    terminalOutput.innerHTML = '';
    addToTerminal('Terminal cleared', 'info');
}

// Toggle terminal
function toggleTerminal() {
    const terminalContainer = document.querySelector('.terminal-container');
    const splitContainer = document.querySelector('.split-container');
    const toggleButton = document.querySelector('.terminal-toggle');

    if (isTerminalCollapsed) {
        terminalContainer.style.height = '25%';
        splitContainer.style.height = '75%';
        toggleButton.textContent = '—';
        isTerminalCollapsed = false;
    } else {
        terminalContainer.style.height = '40px';
        splitContainer.style.height = 'calc(100% - 40px)';
        toggleButton.textContent = '+';
        isTerminalCollapsed = true;
    }

    // Trigger editor layout update
    if (editor) {
        setTimeout(() => editor.layout(), 100);
    }
}

// Add this new function anywhere in your JavaScript
function adjustPanelSizes(direction) {
    const container = document.querySelector('.split-container');
    const currentWidth = parseFloat(container.dataset.editorWidth) || 60;
    let newWidth;

    if (direction === 'increase') {
        newWidth = Math.min(currentWidth + 5, 80); // Increase editor width
    } else {
        newWidth = Math.max(currentWidth - 5, 20); // Decrease editor width
    }

    const editorPanel = document.querySelector('.editor-panel');
    const chatPanel = document.querySelector('.chat-panel');

    editorPanel.style.flex = `0 0 ${newWidth}%`;
    chatPanel.style.flex = `0 0 ${100 - newWidth}%`;
    container.dataset.editorWidth = newWidth;

    // Update editor layout
    if (editor) {
        setTimeout(() => editor.layout(), 100);
    }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.code-block-wrapper {
    margin: 12px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(119, 124, 124, 0.3);
}

.code-block {
    background-color: #1a1a1a !important;
    color: #ffffff;
    padding: 16px;
    margin: 0;
    font-family: 'Berkeley Mono', ui-monospace, monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
}

.code-block code {
    background: none !important;
    padding: 0;
    color: inherit;
}

.inline-code {
    background-color: rgba(119, 124, 124, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Berkeley Mono', ui-monospace, monospace;
    font-size: 12px;
}

.sidebar-icon.copied {
    background-color: rgba(34, 197, 94, 0.2) !important;
    color: #22c55e !important;
    transform: scale(1.1);
    transition: all 0.2s ease;
}
`;
document.head.appendChild(style);

// Clock functionality
function showClock() {
    // Create or update the clock display
    let clockDisplay = document.getElementById('clock-display');

    if (!clockDisplay) {
        // Create the clock display element
        clockDisplay = document.createElement('div');
        clockDisplay.id = 'clock-display';
        clockDisplay.className = 'clock-display';
        document.body.appendChild(clockDisplay);
    }

    // Toggle the clock display
    if (clockDisplay.style.display === 'none' || !clockDisplay.style.display) {
        clockDisplay.style.display = 'block';
        updateTime();
        // Update the clock every second
        if (window.clockInterval) {
            clearInterval(window.clockInterval);
        }
        window.clockInterval = setInterval(updateTime, 1000);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            clockDisplay.style.display = 'none';
            if (window.clockInterval) {
                clearInterval(window.clockInterval);
            }
        }, 10000);
    } else {
        clockDisplay.style.display = 'none';
        if (window.clockInterval) {
            clearInterval(window.clockInterval);
        }
    }
}

function updateTime() {
    const clockDisplay = document.getElementById('clock-display');
    if (clockDisplay && clockDisplay.style.display !== 'none') {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const dateString = now.toLocaleDateString();

        clockDisplay.innerHTML = `
            <div class="clock-time">${timeString}</div>
            <div class="clock-date">${dateString}</div>
            <div class="clock-close" onclick="document.getElementById('clock-display').style.display='none'; clearInterval(window.clockInterval);">×</div>
        `;
    }
}

// Cheatsheet functionality
let cheatsheetData = null;

function toggleCheatsheetPanel(forceOpen = null) {
    const panel = document.getElementById('cheatsheet-panel');
    const icon = document.getElementById('cheatsheet-icon');
    if (!panel) return;

    const isHidden = panel.style.display === 'none' || panel.classList.contains('hidden');
    const shouldOpen = forceOpen === true || (forceOpen === null && isHidden);

    if (shouldOpen) {
        panel.style.display = 'flex';
        panel.classList.remove('hidden');
        if (icon) icon.classList.add('active');
        if (!cheatsheetData) {
            loadCheatsheet();
        }
    } else {
        panel.classList.add('hidden');
        if (icon) icon.classList.remove('active');
        setTimeout(() => { panel.style.display = 'none'; }, 260);
    }
}

function loadCheatsheet() {
    const content = document.getElementById('cheatsheet-content');
    content.innerHTML = '<div class="loading-spinner">Loading...</div>';

    fetch('http://127.0.0.1:8000/cheatsheet/')
        .then(response => response.json())
        .then(data => {
            cheatsheetData = data;
            renderCheatsheet(data);
        })
        .catch(error => {
            console.error('Error loading cheatsheet:', error);
            content.innerHTML = '<div class="error-message">Failed to load cheatsheet data.</div>';
        });
}

function renderCheatsheet(data) {
    const content = document.getElementById('cheatsheet-content');
    content.innerHTML = '';

    if (Object.keys(data).length === 0) {
        content.innerHTML = '<div class="no-results">No items found.</div>';
        return;
    }

    for (const [category, items] of Object.entries(data)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'cheatsheet-category';

        const title = document.createElement('div');
        title.className = 'cheatsheet-category-title';
        title.textContent = category;
        categoryDiv.appendChild(title);

        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cheatsheet-item';

            const name = document.createElement('div');
            name.className = 'cheatsheet-item-name';
            name.textContent = item.name;
            itemDiv.appendChild(name);

            const desc = document.createElement('div');
            desc.className = 'cheatsheet-item-desc';
            desc.textContent = item.description;
            itemDiv.appendChild(desc);

            if (item.syntax) {
                const syntax = document.createElement('div');
                syntax.className = 'cheatsheet-syntax';
                syntax.textContent = item.syntax;
                itemDiv.appendChild(syntax);
            }

            if (item.code_example) {
                const code = document.createElement('div');
                code.className = 'cheatsheet-code';
                code.textContent = item.code_example;
                itemDiv.appendChild(code);
            }

            if (item.documentation_url) {
                const link = document.createElement('a');
                link.className = 'cheatsheet-link';
                link.href = item.documentation_url;
                link.target = '_blank';
                link.textContent = 'Documentation →';
                itemDiv.appendChild(link);
            }

            categoryDiv.appendChild(itemDiv);
        });

        content.appendChild(categoryDiv);
    }
}

function filterCheatsheet() {
    const query = document.getElementById('cheatsheet-search').value.toLowerCase();
    if (!cheatsheetData) return;

    const filteredData = {};
    let hasResults = false;

    for (const [category, items] of Object.entries(cheatsheetData)) {
        const filteredItems = items.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            category.toLowerCase().includes(query)
        );

        if (filteredItems.length > 0) {
            filteredData[category] = filteredItems;
            hasResults = true;
        }
    }

    renderCheatsheet(filteredData);
}

// -----------------------
// Code Examples Panel
// -----------------------
const codeExamples = {
    'hello_world': `# Hello World - Your First Python Program
name = "World"
greeting = "Hello"

def say_hello():
    message = greeting + ", " + name + "!"
    print(message)

say_hello()
print("Welcome to Python!")`,

    'simple_math': `# Simple Calculator with Functions
x = 10
y = 5

def add(a, b):
    result = a + b
    return result

def multiply(a, b):
    result = a * b
    return result

def calculate():
    sum_result = add(x, y)
    product = multiply(x, y)
    print("Sum:", sum_result)
    print("Product:", product)

calculate()`,

    'variables': `# Local vs Global Variables Demo
# Global variables (will be ORANGE in nested scopes)
counter = 0
MAX_VALUE = 100

def increment_counter():
    # Local variables (will be PURPLE)
    step = 5
    new_value = counter + step
    print("Counter:", new_value)
    return new_value

def process_data():
    # Local variables
    data = [1, 2, 3, 4, 5]
    total = 0
    
    for item in data:
        # item is local to the loop
        total += item
        
        # MAX_VALUE is global (ORANGE)
        if total > MAX_VALUE:
            break
    
    return total

result = increment_counter()
print("Total:", process_data())`,

    'factorial': `# Factorial - Recursive and Iterative
def factorial_recursive(n):
    # n is a parameter (local variable)
    if n == 0 or n == 1:
        return 1
    else:
        # Recursive call
        result = n * factorial_recursive(n - 1)
        return result

def factorial_iterative(n):
    # All variables here are local
    result = 1
    i = 1
    
    while i <= n:
        result *= i
        i += 1
    
    return result

# Test both functions
number = 5
print("Recursive:", factorial_recursive(number))
print("Iterative:", factorial_iterative(number))`,

    'fibonacci': `# Fibonacci Sequence Generator
def fibonacci(n):
    # Generate first n Fibonacci numbers
    sequence = []
    a = 0
    b = 1
    
    for i in range(n):
        sequence.append(a)
        # Calculate next number
        temp = a + b
        a = b
        b = temp
    
    return sequence

def fibonacci_sum(n):
    # Calculate sum of first n Fibonacci numbers
    fib_list = fibonacci(n)
    total = 0
    
    for num in fib_list:
        total += num
    
    return total

# Generate and print
count = 10
fib_sequence = fibonacci(count)
print("Fibonacci:", fib_sequence)
print("Sum:", fibonacci_sum(count))`,

    'nested_functions': `# Nested Functions - Perfect for Scope Visualizer!
counter = 0

def outer_function(x):
    # x and outer_var are local to outer_function
    outer_var = 10
    
    def inner_function(y):
        # y and inner_var are local to inner_function
        inner_var = 5
        
        # outer_var is from parent scope (ORANGE)
        # counter is global (ORANGE)
        result = y + inner_var + outer_var + counter
        print("Inner result:", result)
        return result
    
    def another_inner(z):
        # z and temp are local here
        temp = z * 2
        
        # outer_var is from parent scope (ORANGE)
        combined = temp + outer_var
        return combined
    
    # Call inner functions
    value1 = inner_function(x)
    value2 = another_inner(x)
    return value1 + value2

# Test the nested functions
print("Final:", outer_function(5))`,

    'for_loop': `# For Loop Basics
# Global variables
numbers = [1, 2, 3, 4, 5]
multiplier = 2

def process_list():
    # Local variable
    results = []
    
    # Loop variable 'num' is local to the loop
    for num in numbers:
        # doubled is local to the loop
        doubled = num * multiplier
        results.append(doubled)
        print(f"{num} x {multiplier} = {doubled}")
    
    return results

def count_to_ten():
    # i is local to this loop
    for i in range(1, 11):
        # square is local
        square = i * i
        print(f"{i} squared = {square}")

process_list()
count_to_ten()`,

    'while_loop': `# While Loop Example
# Global variables
MAX_COUNT = 10
step = 2

def countdown():
    # Local variable
    count = MAX_COUNT
    
    while count > 0:
        # remaining is local to the loop
        remaining = count - step
        print(f"Count: {count}, Next: {remaining}")
        count -= step

def sum_while():
    # All local variables
    total = 0
    current = 1
    
    while current <= MAX_COUNT:
        total += current
        current += 1
    
    print("Sum:", total)
    return total

countdown()
sum_while()`,

    'nested_loops': `# Nested Loops - Multiplication Table
size = 5

def multiplication_table():
    print("Multiplication Table:")
    
    # Outer loop - i is local
    for i in range(1, size + 1):
        row = ""
        
        # Inner loop - j is local to inner loop
        for j in range(1, size + 1):
            # product is local to inner loop
            product = i * j
            row += f"{product:4}"
        
        print(f"Row {i}: {row}")

def nested_sum():
    # total is local
    total = 0
    
    for i in range(1, size + 1):
        for j in range(1, size + 1):
            # sum_value is local to inner loop
            sum_value = i + j
            total += sum_value
    
    return total

multiplication_table()
print("\\nNested sum:", nested_sum())`,

    'list_operations': `# List Operations
# Global list
fruits = ["apple", "banana", "cherry"]

def list_basics():
    # Local list
    numbers = [1, 2, 3, 4, 5]
    
    # Add elements
    numbers.append(6)
    numbers.insert(0, 0)
    
    # Access elements
    first = numbers[0]
    last = numbers[-1]
    
    print("First:", first, "Last:", last)
    return numbers

def list_methods():
    # Local variables
    data = [5, 2, 8, 1, 9]
    
    # Sort
    data.sort()
    
    # Find max and min
    maximum = max(data)
    minimum = min(data)
    length = len(data)
    
    print(f"Sorted: {data}")
    print(f"Max: {maximum}, Min: {minimum}, Length: {length}")

result = list_basics()
print("Numbers:", result)
list_methods()`,

    'dictionary': `# Dictionary Operations
# Global dictionary
config = {"name": "App", "version": "1.0"}

def dict_basics():
    # Local dictionary
    person = {
        "name": "Alice",
        "age": 25,
        "city": "Paris"
    }
    
    # Access values
    name = person["name"]
    age = person.get("age", 0)
    
    # Add new key
    person["email"] = "alice@example.com"
    
    print(f"{name}, {age} years old")
    return person

def dict_loop():
    # Local dictionary
    scores = {"Alice": 95, "Bob": 87, "Charlie": 92}
    
    # Loop through dictionary
    for name in scores:
        score = scores[name]
        grade = "A" if score >= 90 else "B"
        print(f"{name}: {score} ({grade})")

person_info = dict_basics()
print("Person:", person_info)
dict_loop()`,

    'list_comprehension': `# List Comprehension - Elegant Python
# Global variables
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
threshold = 5

def basic_comprehension():
    # Create list of squares
    squares = [x * x for x in numbers]
    
    # Filter even numbers
    evens = [x for x in numbers if x % 2 == 0]
    
    # Filter and transform
    large_squares = [x * x for x in numbers if x > threshold]
    
    print("Squares:", squares)
    print("Evens:", evens)
    print("Large squares:", large_squares)

def nested_comprehension():
    # Create matrix
    matrix = [[i * j for j in range(1, 4)] for i in range(1, 4)]
    
    # Flatten matrix
    flat = [num for row in matrix for num in row]
    
    print("Matrix:", matrix)
    print("Flattened:", flat)

basic_comprehension()
nested_comprehension()`
};

function toggleExamplesPanel(forceOpen = null) {
    const panel = document.getElementById('examples-panel');
    const icon = document.getElementById('examples-icon');

    if (!panel) return;

    const isHidden = panel.style.display === 'none' || panel.classList.contains('hidden');
    const shouldOpen = forceOpen === true || (forceOpen === null && isHidden);

    if (shouldOpen) {
        panel.style.display = 'flex';
        panel.classList.remove('hidden');
        if (icon) icon.classList.add('active');
    } else {
        panel.classList.add('hidden');
        if (icon) icon.classList.remove('active');
        setTimeout(() => { panel.style.display = 'none'; }, 260);
    }
}

function loadExample(exampleId) {
    const code = codeExamples[exampleId];

    if (!code) {
        console.error('Example not found:', exampleId);
        return;
    }

    if (!editor) {
        console.error('Editor not initialized');
        return;
    }

    // Set the code in the editor
    editor.setValue(code);

    // Move cursor to the beginning
    editor.setPosition({ lineNumber: 1, column: 1 });

    // Focus the editor
    editor.focus();

    // Close the examples panel
    toggleExamplesPanel(false);

    // Show notification
    showNotification(`Loaded: ${exampleId.replace(/_/g, ' ')}`, 'success');
}
