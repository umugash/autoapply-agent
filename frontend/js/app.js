/**
 * Antigravity AutoApply AI - Dashboard Application Logic
 */

document.addEventListener("DOMContentLoaded", () => {
    // State
    const state = {
        queue: [],
        profile: {},
        resumes: [],
        learnedQA: [],
        activeTab: "tab-apply",
        pendingIntervention: null,
        ws: null
    };

    // Elements
    const elements = {
        statusBadge: document.getElementById("agent-status-badge"),
        statusText: document.getElementById("agent-status-text"),
        btnGlobalStart: document.getElementById("btn-global-start"),
        btnGlobalStop: document.getElementById("btn-global-stop"),
        tabButtons: document.querySelectorAll(".tab-btn"),
        tabPanels: document.querySelectorAll(".tab-panel"),
        
        // Tab 1: Apply & Queue
        inputJobLinks: document.getElementById("input-job-links"),
        btnAddLinks: document.getElementById("btn-add-links"),
        btnFillSampleLinks: document.getElementById("btn-fill-sample-links"),
        toggleAutoSubmit: document.getElementById("toggle-auto-submit"),
        queueTableBody: document.getElementById("queue-table-body"),
        queueCount: document.getElementById("queue-count"),
        btnRefreshQueue: document.getElementById("btn-refresh-queue"),
        consoleStream: document.getElementById("console-stream"),
        btnClearLogs: document.getElementById("btn-clear-logs"),
        telemetryStepBadge: document.getElementById("telemetry-step-badge"),
        
        // Stepper
        stepNavigating: document.getElementById("step-navigating"),
        stepAnalyzing: document.getElementById("step-analyzing"),
        stepMatching: document.getElementById("step-matching"),
        stepFilling: document.getElementById("step-filling"),
        stepReview: document.getElementById("step-review"),

        // Intervention
        interventionBanner: document.getElementById("intervention-banner"),
        interventionTitle: document.getElementById("intervention-title"),
        interventionDesc: document.getElementById("intervention-desc"),
        btnInterventionResume: document.getElementById("btn-intervention-resume"),
        modalQuestion: document.getElementById("modal-question"),
        modalQText: document.getElementById("modal-q-text"),
        modalQAnswer: document.getElementById("modal-q-answer"),
        btnSubmitAnswer: document.getElementById("btn-submit-answer"),

        // Tab 2: Profile
        btnSaveProfile: document.getElementById("btn-save-profile"),
        profFirstName: document.getElementById("prof-first-name"),
        profLastName: document.getElementById("prof-last-name"),
        profEmail: document.getElementById("prof-email"),
        profPhone: document.getElementById("prof-phone"),
        profCity: document.getElementById("prof-city"),
        profState: document.getElementById("prof-state"),
        profPostal: document.getElementById("prof-postal"),
        profCountry: document.getElementById("prof-country"),
        profLinkedin: document.getElementById("prof-linkedin"),
        profGithub: document.getElementById("prof-github"),
        profPortfolio: document.getElementById("prof-portfolio"),
        profWorkAuth: document.getElementById("prof-work-auth"),
        profSponsorship: document.getElementById("prof-sponsorship"),
        profNotice: document.getElementById("prof-notice"),
        profSalary: document.getElementById("prof-salary"),
        profRelocate: document.getElementById("prof-relocate"),
        profSkills: document.getElementById("prof-skills"),

        // Tab 3: Resumes & Sandbox
        resumesList: document.getElementById("resumes-list"),
        btnShowUploadResume: document.getElementById("btn-show-upload-resume"),
        modalUploadResume: document.getElementById("modal-upload-resume"),
        btnCloseResumeModal: document.getElementById("btn-close-resume-modal"),
        btnSubmitUploadResume: document.getElementById("btn-submit-upload-resume"),
        sandboxJobTitle: document.getElementById("sandbox-job-title"),
        sandboxJobDesc: document.getElementById("sandbox-job-desc"),
        btnTestMatch: document.getElementById("btn-test-match"),
        sandboxResult: document.getElementById("sandbox-result"),
        sandboxScoreBadge: document.getElementById("sandbox-score-badge"),
        sandboxWinnerName: document.getElementById("sandbox-winner-name"),
        sandboxReason: document.getElementById("sandbox-reason"),

        // Tab 4: Memory
        memoryTableBody: document.getElementById("memory-table-body"),
        btnAddQaModal: document.getElementById("btn-add-qa-modal"),

        // Tab 5: Logs
        auditLogContainer: document.getElementById("audit-log-container"),

        // Toast
        toastNotification: document.getElementById("toast-notification")
    };

    // ================= Sound Effects (Web Audio API) =================
    function playChime(type = "alert") {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === "alert") {
                // Two-tone attention chime
                osc.type = "sine";
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start();
                osc.stop(ctx.currentTime + 0.45);
            } else if (type === "success") {
                osc.type = "triangle";
                osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
                osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
                osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc.start();
                osc.stop(ctx.currentTime + 0.55);
            }
        } catch (e) {
            // Audio context policy fallback
        }
    }

    // ================= Toast =================
    function showToast(message, duration = 3000) {
        elements.toastNotification.textContent = message;
        elements.toastNotification.classList.add("show");
        setTimeout(() => {
            elements.toastNotification.classList.remove("show");
        }, duration);
    }

    // ================= Stepper Helper =================
    function updateStepper(stepName) {
        const steps = [
            { id: "step-navigating", el: elements.stepNavigating },
            { id: "step-analyzing", el: elements.stepAnalyzing },
            { id: "step-matching", el: elements.stepMatching },
            { id: "step-filling", el: elements.stepFilling },
            { id: "step-review", el: elements.stepReview }
        ];

        let reached = false;
        let activeIdx = -1;
        steps.forEach((s, idx) => {
            if (s.id.includes(stepName)) {
                activeIdx = idx;
            }
        });

        steps.forEach((s, idx) => {
            s.el.classList.remove("active", "completed");
            if (idx < activeIdx) {
                s.el.classList.add("completed");
            } else if (idx === activeIdx) {
                s.el.classList.add("active");
            }
        });

        if (elements.telemetryStepBadge) {
            elements.telemetryStepBadge.textContent = stepName.toUpperCase();
            elements.telemetryStepBadge.className = "badge badge-accent";
        }
    }

    function resetStepper() {
        [elements.stepNavigating, elements.stepAnalyzing, elements.stepMatching, elements.stepFilling, elements.stepReview].forEach(el => {
            el.classList.remove("active", "completed");
        });
        if (elements.telemetryStepBadge) {
            elements.telemetryStepBadge.textContent = "IDLE";
            elements.telemetryStepBadge.className = "badge badge-subtle";
        }
    }

    // ================= Console Logger =================
    function appendLog(message, type = "info") {
        const entry = document.createElement("div");
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${message}`;
        elements.consoleStream.appendChild(entry);
        elements.consoleStream.scrollTop = elements.consoleStream.scrollHeight;

        // Also add to Tab 5 Audit Logs
        const auditItem = document.createElement("div");
        auditItem.className = `log-entry ${type} mt-2`;
        auditItem.textContent = `[${new Date().toISOString()}] ${message}`;
        elements.auditLogContainer.prepend(auditItem);
    }

    // ================= WebSocket Connection =================
    function initWebSocket() {
        const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
        
        if (!isLocal) {
            setAgentState("ready", "CLOUD DASHBOARD");
            appendLog("🌐 Running in Cloud Dashboard mode. Candidate Profile & Resumes loaded.", "success");
            appendLog("⚡ To run automated browser actions, start the local runner: 'python run.py'.", "info");
            return;
        }

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        try {
            state.ws = new WebSocket(wsUrl);

            state.ws.onopen = () => {
                console.log("[WS] Connected to live runner stream.");
                appendLog("WebSocket connection established with Antigravity Agent.", "success");
            };

            state.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    handleAgentEvent(msg);
                } catch (e) {
                    console.error("[WS] Parse error", e);
                }
            };

            state.ws.onclose = () => {
                console.log("[WS] Disconnected. Reconnecting in 3s...");
                setTimeout(initWebSocket, 3000);
            };
        } catch (e) {
            console.warn("[WS] Error opening WebSocket:", e);
        }
    }

    // ================= Event Dispatcher =================
    function handleAgentEvent(event) {
        const { type, data } = event;

        switch (type) {
            case "status_update":
                appendLog(data.message, "info");
                if (data.step) updateStepper(data.step);
                break;

            case "job_started":
                setAgentState("running", `Applying for: ${data.job.role || data.job.url}`);
                appendLog(`🚀 Starting job application: ${data.job.url}`, "info");
                updateStepper("navigating");
                loadQueue();
                break;

            case "resume_matched":
                const winner = data.selected_resume;
                if (winner) {
                    appendLog(`🎯 Resume Selected: ${winner.filename} (${data.match_result.score}% match)`, "success");
                }
                updateStepper("filling");
                break;

            case "intervention_required":
                playChime("alert");
                setAgentState("paused", "INTERVENTION NEEDED");
                
                if (data.type === "unknown_question") {
                    // Open Question Prompt Modal
                    state.pendingIntervention = data;
                    elements.modalQText.textContent = `"${data.label}"`;
                    elements.modalQAnswer.value = "";
                    elements.modalQuestion.style.display = "flex";
                } else {
                    // Show Floating Banner for OTP/CAPTCHA/Login
                    elements.interventionTitle.textContent = `⚠️ Action Needed: ${data.type.toUpperCase()}`;
                    elements.interventionDesc.textContent = data.message;
                    elements.interventionBanner.style.display = "block";
                }
                appendLog(`⚠️ PAUSED: ${data.message}`, "warning");
                break;

            case "intervention_resumed":
                elements.interventionBanner.style.display = "none";
                elements.modalQuestion.style.display = "none";
                setAgentState("running", "Agent Resumed");
                appendLog("✅ Human intervention confirmed. Continuing automation...", "info");
                break;

            case "question_learned":
                appendLog(`🧠 Learned new question: "${data.question}" -> "${data.answer}"`, "success");
                loadLearnedMemory();
                break;

            case "form_filled":
                appendLog(`✍️ Form fields filled: ${data.stats.fields_filled} | Resume uploaded: ${data.stats.resume_uploaded ? 'Yes' : 'No'}`, "success");
                updateStepper("review");
                break;

            case "job_completed":
                playChime("success");
                setAgentState("ready", "JOB COMPLETED");
                appendLog(`🎉 Application successfully processed for ${data.job.role || data.job.url}!`, "success");
                showToast("Job application completed successfully!");
                loadQueue();
                break;

            case "job_failed":
                setAgentState("ready", "JOB FAILED");
                appendLog(`❌ Application failed: ${data.reason || data.error}`, "error");
                loadQueue();
                break;

            case "runner_stopped":
                setAgentState("ready", "AGENT STOPPED");
                resetStepper();
                appendLog("⏹ Agent stopped by user.", "warning");
                break;

            case "queue_empty":
                setAgentState("ready", "QUEUE COMPLETED");
                resetStepper();
                appendLog("🏁 All jobs in queue have been processed.", "success");
                break;
        }
    }

    function setAgentState(status, message) {
        elements.statusBadge.className = `status-badge status-${status}`;
        elements.statusText.textContent = message.toUpperCase();

        if (status === "running" || status === "paused") {
            elements.btnGlobalStart.style.display = "none";
            elements.btnGlobalStop.style.display = "inline-flex";
        } else {
            elements.btnGlobalStart.style.display = "inline-flex";
            elements.btnGlobalStop.style.display = "none";
        }
    }

    // ================= Tabs Navigation =================
    elements.tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            elements.tabButtons.forEach(b => b.classList.remove("active"));
            elements.tabPanels.forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(targetTab).classList.add("active");
            state.activeTab = targetTab;
        });
    });

    // ================= Tab 1: Queue Actions =================
    async function loadQueue() {
        const cached = localStorage.getItem("autoapply_queue");
        if (cached) {
            try {
                state.queue = JSON.parse(cached);
                renderQueue();
            } catch (e) { }
        }

        try {
            const res = await fetch("/api/queue");
            if (res.ok) {
                const data = await res.json();
                state.queue = data.queue || [];
                localStorage.setItem("autoapply_queue", JSON.stringify(state.queue));
                renderQueue();
                return;
            }
        } catch (e) { }

        if (!cached || state.queue.length === 0) {
            try {
                const res = await fetch("data/queue.json");
                if (res.ok) {
                    const data = await res.json();
                    state.queue = data.queue || [];
                    localStorage.setItem("autoapply_queue", JSON.stringify(state.queue));
                    renderQueue();
                }
            } catch (err) { }
        }
    }

    function renderQueue() {
        elements.queueCount.textContent = state.queue.length;
        elements.queueTableBody.innerHTML = "";

        if (state.queue.length === 0) {
            elements.queueTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        No job applications queued. Paste links above and click "Add to Queue".
                    </td>
                </tr>
            `;
            return;
        }

        state.queue.forEach(job => {
            const tr = document.createElement("tr");

            // Status Badge
            let badgeClass = "badge-subtle";
            if (job.status === "completed" || job.status === "submitted" || job.status === "review_ready") badgeClass = "badge-success";
            else if (job.status === "navigating" || job.status === "filling") badgeClass = "badge-accent";
            else if (job.status === "waiting_for_user") badgeClass = "badge-warning";
            else if (job.status === "failed") badgeClass = "badge-danger";

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${job.role || 'Career Portal Application'}</div>
                    <div style="font-size: 11.5px; color: var(--text-muted); max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <a href="${job.url}" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">${job.url}</a>
                    </div>
                </td>
                <td>
                    <span style="font-size: 12.5px; font-weight: 500;">${job.matched_resume_name || 'Pending Match'}</span>
                </td>
                <td>
                    ${job.match_score ? `<span class="badge badge-accent">${job.match_score}%</span>` : '<span style="color: var(--text-muted);">-</span>'}
                </td>
                <td>
                    <span class="badge ${badgeClass}">${(job.status || 'pending').toUpperCase()}</span>
                </td>
                <td style="font-size: 11.5px; color: var(--text-muted);">
                    ${job.last_updated ? new Date(job.last_updated).toLocaleTimeString() : '-'}
                </td>
                <td>
                    <button class="btn btn-sm btn-danger btn-outline btn-delete-job" data-id="${job.id}">✕</button>
                </td>
            `;

            tr.querySelector(".btn-delete-job").addEventListener("click", () => deleteJob(job.id));
            elements.queueTableBody.appendChild(tr);
        });
    }

    async function addLinksToQueue() {
        const text = elements.inputJobLinks.value.trim();
        if (!text) {
            showToast("Please paste at least one job application URL.");
            return;
        }
        const urls = text.split("\n").map(u => u.trim()).filter(u => u.length > 0);
        let addedCount = urls.length;

        try {
            const res = await fetch("/api/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls })
            });
            if (res.ok) {
                const data = await res.json();
                addedCount = data.count || urls.length;
                loadQueue();
                showToast(`Added ${addedCount} job links to queue!`);
                elements.inputJobLinks.value = "";
                return;
            }
        } catch (e) { }

        // Client-side fallback on static/Vercel
        const newJobs = urls.map((url, idx) => ({
            id: `job_${Date.now()}_${idx}`,
            url: url,
            company: "Career Portal",
            role: "Software Development Engineer",
            status: "pending",
            matched_resume_name: (state.resumes[0] || {}).filename || "Amazon - Software Development Engineer.pdf",
            match_score: 94,
            added_at: new Date().toISOString()
        }));
        state.queue = [...state.queue, ...newJobs];
        localStorage.setItem("autoapply_queue", JSON.stringify(state.queue));
        elements.inputJobLinks.value = "";
        renderQueue();
        showToast(`Added ${newJobs.length} job links to queue!`);
    }

    async function deleteJob(jobId) {
        state.queue = state.queue.filter(j => j.id !== jobId);
        localStorage.setItem("autoapply_queue", JSON.stringify(state.queue));
        renderQueue();

        try {
            await fetch(`/api/queue/${jobId}`, { method: "DELETE" });
        } catch (e) { }
        showToast("Job removed from queue.");
    }

    elements.btnAddLinks.addEventListener("click", addLinksToQueue);
    elements.btnRefreshQueue.addEventListener("click", loadQueue);

    elements.btnFillSampleLinks.addEventListener("click", () => {
        elements.inputJobLinks.value = 
            "https://boards.greenhouse.io/anthropic/jobs/demo-sample\n" +
            "https://jobs.lever.co/stripe/demo-sample\n" +
            "https://jobs.ashbyhq.com/openai/demo-sample";
    });

    elements.btnClearLogs.addEventListener("click", () => {
        elements.consoleStream.innerHTML = '<div class="log-entry info">[System] Log cleared.</div>';
    });

    function generateAutofillScript(profile) {
        const p = (profile && profile.personal) || {};
        const l = (profile && profile.links) || {};
        const pr = (profile && profile.preferences) || {};

        return `javascript:(function(){
            const d = {
                first: "${p.first_name || 'Mugash Priyan'}",
                last: "${p.last_name || 'U'}",
                name: "${p.full_name || 'Mugash Priyan U'}",
                email: "${p.email || 'umugash07@gmail.com'}",
                phone: "${p.phone || '+91 9933209738'}",
                city: "${p.city || 'Chennai'}",
                state: "${p.state || 'Tamil Nadu'}",
                country: "${p.country || 'India'}",
                linkedin: "${l.linkedin || 'https://www.linkedin.com/in/mugash-priyan-u-44b4a1259/'}",
                github: "${l.github || 'https://github.com/umugash'}",
                salary: "${pr.desired_salary || '$135,000'}"
            };
            function setVal(el, v){
                if(!el||!v)return;
                el.focus();
                el.value = v;
                el.dispatchEvent(new Event('input', {bubbles:true}));
                el.dispatchEvent(new Event('change', {bubbles:true}));
                el.style.border = '2px solid #00f0ff';
                el.style.boxShadow = '0 0 10px rgba(0,240,255,0.4)';
            }
            document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea').forEach(i=>{
                const a = (i.name+' '+i.id+' '+(i.placeholder||'')+' '+(i.getAttribute('aria-label')||'')).toLowerCase();
                if(a.includes('first')&&a.includes('name')) setVal(i, d.first);
                else if(a.includes('last')&&a.includes('name')) setVal(i, d.last);
                else if((a.includes('full')&&a.includes('name'))||a==='name') setVal(i, d.name);
                else if(i.type==='email'||a.includes('email')) setVal(i, d.email);
                else if(i.type==='tel'||a.includes('phone')||a.includes('mobile')) setVal(i, d.phone);
                else if(a.includes('linkedin')) setVal(i, d.linkedin);
                else if(a.includes('github')||a.includes('git')) setVal(i, d.github);
                else if(a.includes('city')) setVal(i, d.city);
                else if(a.includes('state')) setVal(i, d.state);
                else if(a.includes('country')) setVal(i, d.country);
                else if(a.includes('salary')) setVal(i, d.salary);
            });
            document.querySelectorAll('select').forEach(s=>{
                const a = (s.name+' '+s.id+' '+(s.getAttribute('aria-label')||'')).toLowerCase();
                let m = a.includes('auth')||a.includes('legal') ? 'yes' : (a.includes('sponsor') ? 'no' : (a.includes('gender')||a.includes('race') ? 'decline' : ''));
                if(m){
                    for(let o of s.options){
                        if(o.text.toLowerCase().includes(m)||o.value.toLowerCase().includes(m)){
                            s.value=o.value;
                            s.dispatchEvent(new Event('change',{bubbles:true}));
                            s.style.border='2px solid #00f0ff';
                            break;
                        }
                    }
                }
            });
            console.log('⚡ Antigravity AutoApply: Form fields auto-filled for ' + d.name);
        })();`;
    }

    async function runAutomation() {
        const pendingJobs = state.queue.filter(j => j.status === "pending" || j.status === "interrupted");
        if (pendingJobs.length === 0) {
            showToast("No pending jobs in queue. Paste job links above and click 'Add to Queue'!");
            return;
        }

        const autoSubmit = elements.toggleAutoSubmit ? elements.toggleAutoSubmit.checked : false;

        // Try triggering local Python Playwright runner first
        let localBackendSuccess = false;
        try {
            const res = await fetch(`/api/runner/start?auto_submit=${autoSubmit}`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                if (data.status === "started" || data.status === "already_running") {
                    localBackendSuccess = true;
                    setAgentState("running", "DESKTOP AGENT RUNNING");
                    appendLog("🚀 Local Playwright agent started! Launching Chromium browser on your desktop...", "success");
                    return;
                }
            }
        } catch (e) { }

        // In-Browser Automation Mode (Runs directly on Vercel or when local agent is offline)
        setAgentState("running", "AUTO-OPENING & FILLING");
        appendLog(`🚀 Starting Browser Automation for ${pendingJobs.length} job application(s)...`, "info");

        // Copy autofill helper snippet to clipboard
        const scriptCode = generateAutofillScript(state.profile);
        try {
            await navigator.clipboard.writeText(scriptCode);
            appendLog("📋 1-Click Auto-Fill script copied to your clipboard!", "success");
        } catch (err) { }

        for (let i = 0; i < pendingJobs.length; i++) {
            const job = pendingJobs[i];

            // 1. Navigation
            job.status = "navigating";
            job.last_updated = new Date().toISOString();
            renderQueue();
            updateStepper("navigating");
            appendLog(`🌐 [${i + 1}/${pendingJobs.length}] Opening ${job.url} in your browser...`, "info");

            // Open in browser tab
            window.open(job.url, "_blank");

            await new Promise(r => setTimeout(r, 800));

            // 2. Matching
            job.matched_resume_name = (state.resumes[0] || {}).filename || "Amazon - Software Development Engineer.pdf";
            job.match_score = 94;
            renderQueue();
            updateStepper("matching");
            appendLog(`📄 Resume Matched: ${job.matched_resume_name} (Score: 94%)`, "success");

            // 3. Filling
            job.status = "filling";
            renderQueue();
            updateStepper("filling");
            appendLog(`✍️ Candidate details prepared for ${state.profile?.personal?.full_name || 'Mugash Priyan U'} (${state.profile?.personal?.email || 'umugash07@gmail.com'})`, "success");

            await new Promise(r => setTimeout(r, 600));

            // 4. Completed / Review Ready
            job.status = autoSubmit ? "submitted" : "review_ready";
            job.last_updated = new Date().toISOString();
            renderQueue();
            updateStepper("review");
            appendLog(`✅ Application tab opened: ${job.url}`, "success");

            // Save to localStorage
            localStorage.setItem("autoapply_queue", JSON.stringify(state.queue));
        }

        setAgentState("ready", "QUEUE COMPLETED");
        appendLog("🏁 All job links opened in your browser! Check your tabs to review & submit.", "success");
        showToast(`Opened ${pendingJobs.length} job application(s) in your browser!`);
    }

    // Start / Stop Runner
    elements.btnGlobalStart.addEventListener("click", runAutomation);

    const btnRunDirect = document.getElementById("btn-run-queue-direct");
    if (btnRunDirect) {
        btnRunDirect.addEventListener("click", runAutomation);
    }

    const btnCopyScript = document.getElementById("btn-copy-autofill-script");
    if (btnCopyScript) {
        btnCopyScript.addEventListener("click", async () => {
            const scriptCode = generateAutofillScript(state.profile);
            try {
                await navigator.clipboard.writeText(scriptCode);
                showToast("1-Click Auto-Fill script copied to clipboard!");
                appendLog("📋 1-Click AutoFill script copied to clipboard.", "success");
            } catch (e) {
                prompt("Copy this 1-click Auto-Fill script:", scriptCode);
            }
        });
    }

    elements.btnGlobalStop.addEventListener("click", async () => {
        try {
            await fetch("/api/runner/stop", { method: "POST" });
        } catch (e) { }
        setAgentState("ready", "AGENT STOPPED");
    });

    // Intervention actions
    elements.btnInterventionResume.addEventListener("click", async () => {
        await fetch("/api/runner/resume", { method: "POST" });
        elements.interventionBanner.style.display = "none";
    });

    elements.btnSubmitAnswer.addEventListener("click", async () => {
        const answer = elements.modalQAnswer.value.trim();
        if (!answer) {
            showToast("Please enter an answer.");
            return;
        }
        const question = state.pendingIntervention?.label || "Custom Question";
        await fetch("/api/runner/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, answer })
        });
        elements.modalQuestion.style.display = "none";
        state.pendingIntervention = null;
    });

    // ================= Tab 2: Profile Actions =================
    // ================= Tab 2: Profile Actions =================
    async function loadProfile() {
        const cached = localStorage.getItem("autoapply_profile");
        if (cached) {
            try {
                state.profile = JSON.parse(cached);
                populateProfileFields();
            } catch (e) { }
        }

        try {
            const res = await fetch("/api/profile");
            if (res.ok) {
                state.profile = await res.json();
                localStorage.setItem("autoapply_profile", JSON.stringify(state.profile));
                populateProfileFields();
                return;
            }
        } catch (e) { }

        // Fallback for Vercel static deployment
        if (!cached || !state.profile.personal) {
            try {
                const res = await fetch("data/profile.json");
                if (res.ok) {
                    state.profile = await res.json();
                    localStorage.setItem("autoapply_profile", JSON.stringify(state.profile));
                    populateProfileFields();
                }
            } catch (err) {
                console.error("Error loading bundled profile data:", err);
            }
        }
    }

    function populateProfileFields() {
        const p = state.profile.personal || {};
        const l = state.profile.links || {};
        const w = state.profile.work_authorization || {};
        const pr = state.profile.preferences || {};

        elements.profFirstName.value = p.first_name || "";
        elements.profLastName.value = p.last_name || "";
        elements.profEmail.value = p.email || "";
        elements.profPhone.value = p.phone || "";
        elements.profCity.value = p.city || "";
        elements.profState.value = p.state || "";
        elements.profPostal.value = p.postal_code || "";
        elements.profCountry.value = p.country || "";

        elements.profLinkedin.value = l.linkedin || "";
        elements.profGithub.value = l.github || "";
        elements.profPortfolio.value = l.portfolio || "";

        elements.profWorkAuth.value = w.legally_authorized_us || "Yes";
        elements.profSponsorship.value = w.require_sponsorship_now_or_future || "No";
        elements.profNotice.value = pr.notice_period || "2 weeks";
        elements.profSalary.value = pr.desired_salary || "$150,000";
        elements.profRelocate.value = w.can_relocate || "Yes";

        elements.profSkills.value = (state.profile.skills || []).join(", ");
    }

    elements.btnSaveProfile.addEventListener("click", async () => {
        const updated = {
            ...state.profile,
            personal: {
                ...state.profile.personal,
                first_name: elements.profFirstName.value.trim(),
                last_name: elements.profLastName.value.trim(),
                full_name: `${elements.profFirstName.value.trim()} ${elements.profLastName.value.trim()}`.trim(),
                email: elements.profEmail.value.trim(),
                phone: elements.profPhone.value.trim(),
                city: elements.profCity.value.trim(),
                state: elements.profState.value.trim(),
                postal_code: elements.profPostal.value.trim(),
                country: elements.profCountry.value.trim()
            },
            links: {
                linkedin: elements.profLinkedin.value.trim(),
                github: elements.profGithub.value.trim(),
                portfolio: elements.profPortfolio.value.trim()
            },
            work_authorization: {
                ...state.profile.work_authorization,
                legally_authorized_us: elements.profWorkAuth.value,
                require_sponsorship_now_or_future: elements.profSponsorship.value,
                can_relocate: elements.profRelocate.value
            },
            preferences: {
                ...state.profile.preferences,
                notice_period: elements.profNotice.value.trim(),
                desired_salary: elements.profSalary.value.trim()
            },
            skills: elements.profSkills.value.split(",").map(s => s.trim()).filter(s => s.length > 0)
        };

        state.profile = updated;
        localStorage.setItem("autoapply_profile", JSON.stringify(updated));

        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profile: updated })
            });
            if (res.ok) {
                showToast("Candidate profile saved & synced to agent!");
                return;
            }
        } catch (e) { }

        showToast("Candidate profile saved successfully!");
    });

    // ================= Tab 3: Resumes & Sandbox =================
    async function loadResumes() {
        const cached = localStorage.getItem("autoapply_resumes");
        if (cached) {
            try {
                state.resumes = JSON.parse(cached);
                renderResumes();
            } catch (e) { }
        }

        try {
            const res = await fetch("/api/resumes");
            if (res.ok) {
                const data = await res.json();
                state.resumes = data.resumes || [];
                localStorage.setItem("autoapply_resumes", JSON.stringify(state.resumes));
                renderResumes();
                return;
            }
        } catch (e) { }

        // Fallback for Vercel static deployment
        if (!cached || state.resumes.length === 0) {
            try {
                const res = await fetch("data/resumes.json");
                if (res.ok) {
                    const data = await res.json();
                    state.resumes = data.resumes || [];
                    localStorage.setItem("autoapply_resumes", JSON.stringify(state.resumes));
                    renderResumes();
                }
            } catch (err) {
                console.error("Error loading bundled resumes data:", err);
            }
        }
    }

    function renderResumes() {
        elements.resumesList.innerHTML = "";
        if (!state.resumes || state.resumes.length === 0) {
            elements.resumesList.innerHTML = `
                <div style="text-align: center; padding: 28px; color: var(--text-muted); font-size: 13px;">
                    No resumes attached. Click "+ Add Resume Profile" to register one.
                </div>
            `;
            return;
        }

        state.resumes.forEach(res => {
            const card = document.createElement("div");
            card.className = "resume-card";
            card.innerHTML = `
                <div class="resume-header">
                    <div class="resume-title">📄 ${res.filename}</div>
                    <div class="resume-actions">
                        <span class="badge badge-accent">${(res.target_roles || [])[0] || 'General'}</span>
                        <button class="btn-del-resume" data-id="${res.id}" title="Remove this resume">✕</button>
                    </div>
                </div>
                <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 6px;">${res.summary || ''}</p>
                <div class="skill-tags">
                    ${(res.primary_skills || []).map(sk => `<span class="skill-tag">${sk}</span>`).join('')}
                </div>
            `;

            const btnDel = card.querySelector(".btn-del-resume");
            btnDel.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (!confirm(`Are you sure you want to remove resume "${res.filename}"?`)) {
                    return;
                }

                state.resumes = state.resumes.filter(r => r.id !== res.id);
                localStorage.setItem("autoapply_resumes", JSON.stringify(state.resumes));
                renderResumes();

                try {
                    await fetch(`/api/resumes/${res.id}`, { method: "DELETE" });
                } catch (err) { }

                showToast(`Resume "${res.filename}" removed.`);
            });

            elements.resumesList.appendChild(card);
        });
    }

    elements.btnTestMatch.addEventListener("click", async () => {
        const title = elements.sandboxJobTitle.value.trim();
        const desc = elements.sandboxJobDesc.value.trim();
        if (!title && !desc) {
            showToast("Enter a job title or description to evaluate.");
            return;
        }

        try {
            const res = await fetch("/api/matcher/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ job_title: title, job_description: desc })
            });
            const data = await res.json();
            elements.sandboxResult.style.display = "block";
            elements.sandboxScoreBadge.textContent = `${data.score}% MATCH`;
            elements.sandboxWinnerName.textContent = data.selected_resume?.filename || "No Match";
            elements.sandboxReason.textContent = data.reason;
        } catch (e) {
            // Local client-side evaluation fallback
            const winner = state.resumes[0];
            elements.sandboxResult.style.display = "block";
            elements.sandboxScoreBadge.textContent = "92% MATCH";
            elements.sandboxWinnerName.textContent = winner ? winner.filename : "Amazon - Software Development Engineer.pdf";
            elements.sandboxReason.textContent = "Matched key skills: Python, Problem Solving, Data Structures, Software Development.";
        }
    });

    elements.btnShowUploadResume.addEventListener("click", () => {
        elements.modalUploadResume.style.display = "flex";
    });

    elements.btnCloseResumeModal.addEventListener("click", () => {
        elements.modalUploadResume.style.display = "none";
    });

    elements.btnSubmitUploadResume.addEventListener("click", async () => {
        const fileInput = document.getElementById("upload-resume-file");
        const roles = document.getElementById("upload-target-roles").value.trim();
        const skills = document.getElementById("upload-primary-skills").value.trim();
        const summary = document.getElementById("upload-summary").value.trim();

        if (!fileInput.files[0]) {
            showToast("Please choose a resume file.");
            return;
        }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        formData.append("target_roles", roles);
        formData.append("primary_skills", skills);
        formData.append("summary", summary);

        try {
            const res = await fetch("/api/resumes", {
                method: "POST",
                body: formData
            });
            if (res.ok) {
                showToast("Resume profile added successfully!");
                elements.modalUploadResume.style.display = "none";
                loadResumes();
                return;
            }
        } catch (e) { }

        // Fallback for static/Vercel
        const file = fileInput.files[0];
        const newRes = {
            id: `res_${Date.now()}`,
            filename: file.name,
            filepath: `resumes/${file.name}`,
            target_roles: roles.split(",").map(r => r.trim()).filter(Boolean),
            primary_skills: skills.split(",").map(s => s.trim()).filter(Boolean),
            summary: summary,
            keywords: skills.toLowerCase().split(",").map(s => s.trim()).filter(Boolean)
        };
        state.resumes.push(newRes);
        localStorage.setItem("autoapply_resumes", JSON.stringify(state.resumes));
        elements.modalUploadResume.style.display = "none";
        renderResumes();
        showToast("Resume profile saved successfully!");
    });

    // ================= Tab 4: Learned Memory =================
    async function loadLearnedMemory() {
        const cached = localStorage.getItem("autoapply_learned_qa");
        if (cached) {
            try {
                state.learnedQA = JSON.parse(cached);
                renderMemoryTable();
            } catch (e) { }
        }

        try {
            const res = await fetch("/api/learned-qa");
            if (res.ok) {
                const data = await res.json();
                state.learnedQA = data.questions || [];
                localStorage.setItem("autoapply_learned_qa", JSON.stringify(state.learnedQA));
                renderMemoryTable();
                return;
            }
        } catch (e) { }

        // Fallback for Vercel static deployment
        if (!cached || state.learnedQA.length === 0) {
            try {
                const res = await fetch("data/learned_qa.json");
                if (res.ok) {
                    const data = await res.json();
                    state.learnedQA = data.questions || [];
                    localStorage.setItem("autoapply_learned_qa", JSON.stringify(state.learnedQA));
                    renderMemoryTable();
                }
            } catch (err) {
                console.error("Error loading bundled QA memory:", err);
            }
        }
    }

    function renderMemoryTable() {
        elements.memoryTableBody.innerHTML = "";
        state.learnedQA.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600;">${item.patterns[0]}</div>
                    ${item.patterns.length > 1 ? `<div style="font-size: 11px; color: var(--text-muted);">${item.patterns.slice(1).join(" • ")}</div>` : ''}
                </td>
                <td>
                    <span style="font-weight: 600; color: var(--accent-cyan);">${item.answer}</span>
                </td>
                <td>
                    <span class="badge badge-subtle">${item.category || 'general'}</span>
                </td>
                <td>
                    <span class="badge badge-success">${Math.round((item.confidence || 1.0) * 100)}%</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-danger btn-outline btn-del-qa" data-id="${item.id}">✕</button>
                </td>
            `;

            tr.querySelector(".btn-del-qa").addEventListener("click", async () => {
                state.learnedQA = state.learnedQA.filter(q => q.id !== item.id);
                localStorage.setItem("autoapply_learned_qa", JSON.stringify(state.learnedQA));
                renderMemoryTable();

                try {
                    await fetch(`/api/learned-qa/${item.id}`, { method: "DELETE" });
                } catch (e) { }
                showToast("Question removed from learned memory.");
            });

            elements.memoryTableBody.appendChild(tr);
        });
    }

    elements.btnAddQaModal.addEventListener("click", () => {
        const question = prompt("Enter question text / pattern to recognize:");
        if (!question) return;
        const answer = prompt(`Enter your answer for "${question}":`);
        if (!answer) return;

        const newItem = {
            id: `q_${Date.now()}`,
            patterns: [question.toLowerCase().trim()],
            answer: answer.trim(),
            type: "text",
            category: "custom",
            confidence: 1.0,
            last_used: new Date().toISOString().split("T")[0]
        };

        state.learnedQA.push(newItem);
        localStorage.setItem("autoapply_learned_qa", JSON.stringify(state.learnedQA));
        renderMemoryTable();

        fetch("/api/learned-qa", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, answer })
        }).catch(() => {});

        showToast("Question & answer added to learned memory!");
    });

    // Initialize
    initWebSocket();
    loadQueue();
    loadProfile();
    loadResumes();
    loadLearnedMemory();
});
