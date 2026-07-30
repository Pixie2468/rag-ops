document.addEventListener('DOMContentLoaded', () => {
    // 1. Copy to clipboard functionality
    const copyBtn = document.getElementById('copy-install');
    const installCommand = document.getElementById('install-command');

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(installCommand.innerText);
            
            // Visual feedback
            const originalIcon = copyBtn.innerHTML;
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = originalIcon;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    });

    // 2. Scroll Animations (Intersection Observer)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal-on-scroll').forEach(element => {
        observer.observe(element);
    });

    // 3. Interactive Playground Logic
    const jsonInput = document.getElementById('json-input');
    const loadExampleBtn = document.getElementById('load-example-btn');
    const fileUpload = document.getElementById('file-upload');
    const dropZone = document.getElementById('drop-zone');
    const runEvalBtn = document.getElementById('run-eval-btn');
    const evalStatus = document.getElementById('eval-status');
    const evalOutput = document.getElementById('eval-output');

    // Load example JSON
    loadExampleBtn.addEventListener('click', async () => {
        try {
            // Attempt to load data.json from root if served from same origin
            const response = await fetch('../data.json');
            if (response.ok) {
                const data = await response.json();
                jsonInput.value = JSON.stringify(data, null, 2);
            }
        } catch (e) {
            // Fallback to placeholder if not found
            jsonInput.value = `{
  "query": "What is the capital of France?",
  "context_chunks": [
    "France is a country in Western Europe.",
    "Paris is the capital and most populous city of France."
  ],
  "answer": "The capital of France is Paris."
}`;
        }
    });

    // File Upload handling
    fileUpload.addEventListener('change', handleFileSelect);
    
    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileUpload.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });

    function handleFileSelect() {
        const file = fileUpload.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                jsonInput.value = JSON.stringify(json, null, 2);
                evalStatus.textContent = 'File loaded';
                evalStatus.className = 'status-indicator';
            } catch (err) {
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    }

    // Run Evaluation API Call
    runEvalBtn.addEventListener('click', async () => {
        const jsonText = jsonInput.value.trim();
        if (!jsonText) return;

        let payload;
        try {
            payload = JSON.parse(jsonText);
        } catch (err) {
            evalStatus.textContent = 'Invalid JSON';
            evalStatus.className = 'status-indicator error';
            return;
        }

        // Validate payload structure
        if (!payload.query || !payload.context_chunks || !payload.answer) {
            evalStatus.textContent = 'Missing fields';
            evalStatus.className = 'status-indicator error';
            alert("JSON must contain 'query', 'context_chunks', and 'answer' fields.");
            return;
        }

        // Update UI
        evalStatus.textContent = 'Evaluating...';
        evalStatus.className = 'status-indicator';
        runEvalBtn.disabled = true;
        runEvalBtn.textContent = 'Running...';
        
        evalOutput.innerHTML = '<div class="terminal-placeholder">Sending request to http://localhost:8000/evaluate/...<br><br><span class="typing-text" data-text="Processing">Processing</span></div>';

        try {
            const response = await fetch('http://localhost:8000/evaluate/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            evalStatus.textContent = 'Success';
            evalStatus.className = 'status-indicator success';
            
            // Format Output
            const isPass = data.verdict && data.verdict.toLowerCase() === 'pass';
            const icon = isPass ? '<span class="highlight">✔</span>' : '<span style="color: #ff5f56">✘</span>';
            
            let metricsHtml = '';
            if (data.metrics) {
                for (const [key, val] of Object.entries(data.metrics)) {
                    metricsHtml += `├─ ${key}: <span class="highlight">${val}</span>\n`;
                }
            }
            
            evalOutput.innerHTML = `
<div class="mock-output visible">
${icon} Evaluation Verdict: <span class="key">${data.verdict}</span>

<b>QUERY:</b> "${payload.query}"
<b>ANSWER:</b> "${payload.answer}"

<span class="key">DETAILS</span>
${data.stage_failed ? `├─ Failed Stage: <span style="color: #ff5f56">${data.stage_failed}</span>\n` : ''}\
${data.judge_score !== null && data.judge_score !== undefined ? `├─ Judge Score: <span class="highlight">${data.judge_score}</span>\n` : ''}\
${data.judge_reasoning ? `├─ Judge Reasoning: ${data.judge_reasoning}\n` : ''}\
${data.tags && data.tags.length ? `├─ Tags: ${data.tags.join(', ')}\n` : ''}\
${metricsHtml ? `\n<span class="key">METRICS</span>\n${metricsHtml}` : ''}
</div>`;

        } catch (err) {
            console.error(err);
            evalStatus.textContent = 'Error';
            evalStatus.className = 'status-indicator error';
            
            evalOutput.innerHTML = `
<div class="mock-output visible">
<span style="color: #ff5f56">✘ Error connecting to backend</span>

<span class="comment"># Make sure your FastAPI backend is running!</span>
<span class="comment"># Command: docker compose up -d</span>
<span class="comment"># Or cd backend && uv run uvicorn rag_ops.main:app</span>

<span class="key">Details:</span> ${err.message}
</div>`;
        } finally {
            runEvalBtn.disabled = false;
            runEvalBtn.textContent = 'Run Evaluation';
        }
    });

    // 4. Parallax effect for glow orbs
    document.addEventListener('mousemove', (e) => {
        const orbs = document.querySelectorAll('.glow-orb');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        orbs[0].style.transform = `translate(${x * 30}px, ${y * 30}px)`;
        orbs[1].style.transform = `translate(${x * -40}px, ${y * -40}px)`;
    });
});
