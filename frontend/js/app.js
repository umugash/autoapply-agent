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
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
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
            console.log("[WS] Disconnected. Reconnecting in 2s...");
            setTimeout(initWebSocket, 2000);
        };
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
        try {
            const res = await fetch("/api/queue");
            const data = await res.json();
            state.queue = data.queue || [];
            renderQueue();
        } catch (e) {
            console.error("Error loading queue:", e);
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
        try {
            const res = await fetch("/api/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls })
            });
            const data = await res.json();
            showToast(`Added ${data.count} job links to queue!`);
            elements.inputJobLinks.value = "";
            loadQueue();
        } catch (e) {
            showToast("Error adding jobs to queue.");
        }
    }

    async function deleteJob(jobId) {
        try {
            await fetch(`/api/queue/${jobId}`, { method: "DELETE" });
            loadQueue();
        } catch (e) {
            showToast("Failed to delete job.");
        }
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

    // Start / Stop Runner
    elements.btnGlobalStart.addEventListener("click", async () => {
        const autoSubmit = elements.toggleAutoSubmit.checked;
        await fetch(`/api/runner/start?auto_submit=${autoSubmit}`, { method: "POST" });
        setAgentState("running", "AGENT RUNNING");
        appendLog("Initiating application runner...", "info");
    });

    elements.btnGlobalStop.addEventListener("click", async () => {
        await fetch("/api/runner/stop", { method: "POST" });
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
    async function loadProfile() {
        try {
            const res = await fetch("/api/profile");
            state.profile = await res.json();
            populateProfileFields();
        } catch (e) {
            console.error("Error loading profile:", e);
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

        try {
            await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profile: updated })
            });
            state.profile = updated;
            showToast("Candidate profile saved successfully!");
        } catch (e) {
            showToast("Failed to save profile.");
        }
    });

    // ================= Tab 3: Resumes & Sandbox =================
    async function loadResumes() {
        try {
            const res = await fetch("/api/resumes");
            const data = await res.json();
            state.resumes = data.resumes || [];
            renderResumes();
        } catch (e) {
            console.error("Error loading resumes:", e);
        }
    }

    function renderResumes() {
        elements.resumesList.innerHTML = "";
        state.resumes.forEach(res => {
            const card = document.createElement("div");
            card.className = "resume-card";
            card.innerHTML = `
                <div class="resume-header">
                    <div class="resume-title">📄 ${res.filename}</div>
                    <span class="badge badge-accent">${(res.target_roles || [])[0] || 'General'}</span>
                </div>
                <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 6px;">${res.summary || ''}</p>
                <div class="skill-tags">
                    ${(res.primary_skills || []).map(sk => `<span class="skill-tag">${sk}</span>`).join('')}
                </div>
            `;
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
            showToast("Matching evaluation error.");
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
            await fetch("/api/resumes", {
                method: "POST",
                body: formData
            });
            showToast("Resume profile added successfully!");
            elements.modalUploadResume.style.display = "none";
            loadResumes();
        } catch (e) {
            showToast("Error uploading resume.");
        }
    });

    // ================= Tab 4: Learned Memory =================
    async function loadLearnedMemory() {
        try {
            const res = await fetch("/api/learned-qa");
            const data = await res.json();
            state.learnedQA = data.questions || [];
            renderMemoryTable();
        } catch (e) {
            console.error("Error loading learned memory:", e);
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
                await fetch(`/api/learned-qa/${item.id}`, { method: "DELETE" });
                loadLearnedMemory();
            });

            elements.memoryTableBody.appendChild(tr);
        });
    }

    elements.btnAddQaModal.addEventListener("click", () => {
        const question = prompt("Enter question text / pattern to recognize:");
        if (!question) return;
        const answer = prompt(`Enter your answer for "${question}":`);
        if (!answer) return;

        fetch("/api/learned-qa", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, answer })
        }).then(() => {
            showToast("Question & answer added to learned memory!");
            loadLearnedMemory();
        });
    });

    // Initialize
    initWebSocket();
    loadQueue();
    loadProfile();
    loadResumes();
    loadLearnedMemory();
});
