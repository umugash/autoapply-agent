import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from .knowledge import KnowledgeBase
from .matcher import ResumeMatcher
from .form_filler import FormFiller
from .browser_controller import BrowserController

class AgentRunner:
    """
    Coordinates the entire automated job application lifecycle:
    Queue processing -> JD Extraction -> Resume Selection -> Form Auto-Filling ->
    Intervention Management -> Dynamic Learning -> Final Review.
    """
    def __init__(self, data_dir: Optional[str] = None, headless: bool = False):
        if data_dir is None:
            self.data_dir = Path(__file__).resolve().parent.parent / "data"
        else:
            self.data_dir = Path(data_dir)

        self.queue_path = self.data_dir / "queue.json"
        self.headless = headless
        
        self.kb = KnowledgeBase(data_dir=str(self.data_dir))
        self.matcher = ResumeMatcher(data_dir=str(self.data_dir))
        self.filler = FormFiller(self.kb)
        self.browser = BrowserController(headless=self.headless)

        self.is_running = False
        self.current_job_id: Optional[str] = None
        self.logs: List[Dict[str, Any]] = []
        self.listeners: List[Callable[[Dict[str, Any]], Any]] = []

    def subscribe(self, callback: Callable[[Dict[str, Any]], Any]):
        """Subscribes a listener (e.g., WebSocket sender) to live runner events."""
        self.listeners.append(callback)

    async def emit(self, event_type: str, data: Dict[str, Any]):
        """Dispatches an event to all subscribers."""
        event = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        self.logs.append(event)
        for listener in self.listeners:
            try:
                if asyncio.iscoroutinefunction(listener):
                    await listener(event)
                else:
                    listener(event)
            except Exception as e:
                print(f"[Runner] Error emitting event to listener: {e}")

    def load_queue(self) -> List[Dict[str, Any]]:
        """Reads job queue from disk."""
        if self.queue_path.exists():
            with open(self.queue_path, "r", encoding="utf-8") as f:
                return json.load(f).get("queue", [])
        return []

    def save_queue(self, queue: List[Dict[str, Any]]):
        """Persists job queue to disk."""
        with open(self.queue_path, "w", encoding="utf-8") as f:
            json.dump({"queue": queue}, f, indent=2)

    def add_to_queue(self, urls: List[str]) -> List[Dict[str, Any]]:
        """Appends new job links to the application queue."""
        queue = self.load_queue()
        added = []
        for url in urls:
            url = url.strip()
            if not url or not url.startswith("http"):
                continue
            job_id = f"job_{int(datetime.utcnow().timestamp() * 1000)}_{len(queue) + 1}"
            job_item = {
                "id": job_id,
                "url": url,
                "company": "Auto-Detecting",
                "role": "Pending Analysis",
                "status": "pending",
                "matched_resume_id": None,
                "matched_resume_name": None,
                "match_score": 0,
                "added_at": datetime.utcnow().isoformat(),
                "last_updated": datetime.utcnow().isoformat(),
                "notes": "Queued for processing"
            }
            queue.append(job_item)
            added.append(job_item)
        self.save_queue(queue)
        return added

    async def stop(self):
        """Stops the current runner and shuts down browser."""
        self.is_running = False
        await self.browser.close()
        await self.emit("runner_stopped", {"message": "Runner stopped by user."})

    async def resume_intervention(self):
        """Signals browser controller to resume after human intervention."""
        self.browser.resume()
        await self.emit("intervention_resumed", {"message": "Intervention completed. Resuming agent."})

    async def answer_pending_question(self, question: str, answer: str):
        """Learns new question provided by user via UI and resumes runner."""
        learned = self.kb.learn_question(question, answer)
        await self.emit("question_learned", {
            "question": question,
            "answer": answer,
            "entry": learned
        })
        self.browser.resume()

    async def run_next_in_queue(self, auto_submit: bool = False):
        """Processes all pending jobs in the queue sequentially."""
        if self.is_running:
            return
        self.is_running = True

        try:
            while self.is_running:
                queue = self.load_queue()
                pending_jobs = [j for j in queue if j.get("status") in ["pending", "interrupted"]]

                if not pending_jobs:
                    await self.emit("queue_empty", {"message": "All jobs in queue have been processed."})
                    break

                target_job = pending_jobs[0]
                self.current_job_id = target_job["id"]

                try:
                    await self.process_single_job(target_job, auto_submit=auto_submit)
                except Exception as e:
                    print(f"[Runner] Error running job {target_job['id']}: {e}")
                    target_job["status"] = "failed"
                    target_job["notes"] = f"Error: {str(e)}"
                    self.save_queue(queue)
                    await self.emit("job_failed", {"job_id": target_job["id"], "error": str(e)})

                # Allow brief pause between job applications
                await asyncio.sleep(2)
        finally:
            self.is_running = False
            self.current_job_id = None

    async def process_single_job(self, job: Dict[str, Any], auto_submit: bool = False):
        """Full pipeline for a single job link."""
        url = job["url"]
        job["status"] = "navigating"
        job["last_updated"] = datetime.utcnow().isoformat()
        
        queue = self.load_queue()
        for idx, q_item in enumerate(queue):
            if q_item["id"] == job["id"]:
                queue[idx] = job
                break
        self.save_queue(queue)

        await self.emit("job_started", {"job": job})

        # 1. Launch / Navigate
        await self.emit("status_update", {"step": "navigating", "message": f"Opening {url}..."})
        nav_success = await self.browser.navigate_to(url)
        if not nav_success:
            job["status"] = "failed"
            job["notes"] = "Failed to navigate to target URL"
            self.save_queue(queue)
            await self.emit("job_failed", {"job_id": job["id"], "reason": job["notes"]})
            return

        # 2. Check for immediate intervention (Cloudflare / Login / Captcha)
        early_intervention = await self.browser.check_for_human_intervention()
        if early_intervention:
            await self.emit("intervention_required", {
                "type": early_intervention,
                "message": f"Human verification required ({early_intervention.upper()}). Please complete on screen."
            })
            await self.browser.trigger_intervention(
                early_intervention,
                f"Please complete {early_intervention.upper()} verification on screen, then click 'Done & Resume'."
            )

        # 3. Extract page text & job title
        await self.emit("status_update", {"step": "analyzing", "message": "Analyzing Job Description & Requirements..."})
        page_info = await self.browser.extract_page_text_and_title()
        job_title = page_info["title"] or "Software Role"
        job_text = page_info["text"]

        job["role"] = job_title
        
        # 4. Resume Matching
        await self.emit("status_update", {"step": "matching_resume", "message": "Matching best resume for role..."})
        match_result = self.matcher.match(job_title, job_text)
        selected_res = match_result.get("selected_resume")

        if selected_res:
            job["matched_resume_id"] = selected_res["id"]
            job["matched_resume_name"] = selected_res["filename"]
            job["match_score"] = match_result["score"]
            job["notes"] = match_result["reason"]
            resume_path = selected_res["filepath"] if selected_res.get("exists") else None
        else:
            resume_path = None
            job["notes"] = "No matching resume found"

        await self.emit("resume_matched", {
            "job_id": job["id"],
            "selected_resume": selected_res,
            "match_result": match_result
        })

        # 5. Look for "Apply Now" button if form is not yet visible
        page = self.browser.page
        if page:
            apply_btn = await page.query_selector("a:has-text('Apply'), button:has-text('Apply'), [data-automation-id*='apply']")
            if apply_btn:
                try:
                    is_form_already_visible = await page.query_selector("input[name*='email'], input[id*='email']")
                    if not is_form_already_visible:
                        await apply_btn.click()
                        await page.wait_for_timeout(2000)
                        await self.browser.inject_highlighter()
                except Exception:
                    pass

        # 6. Fill Form
        await self.emit("status_update", {"step": "filling", "message": "Auto-filling applicant details and screening questions..."})
        
        async def on_intervention_needed(inter_data: Dict[str, Any]):
            await self.emit("intervention_required", inter_data)
            await self.browser.trigger_intervention("unknown_field", inter_data["message"])

        stats = await self.filler.process_form(
            page=self.browser.page,
            resume_path=resume_path,
            on_intervention_needed=on_intervention_needed
        )

        await self.emit("form_filled", {
            "job_id": job["id"],
            "stats": stats
        })

        # 7. Check final submission
        if auto_submit:
            submit_btn = await page.query_selector("button[type='submit'], input[type='submit'], button:has-text('Submit Application')")
            if submit_btn:
                await submit_btn.click()
                job["status"] = "submitted"
                job["notes"] = "Application automatically submitted!"
            else:
                job["status"] = "review_ready"
                job["notes"] = "All fields filled. Submit button requires confirmation."
        else:
            job["status"] = "review_ready"
            job["notes"] = f"Fields filled ({stats['fields_filled']}). Application ready for your final 1-click review."

            # Highlight submit button for user review
            if page:
                await page.evaluate("""() => {
                    const btn = document.querySelector("button[type='submit'], input[type='submit'], button:has-text('Submit')");
                    if (btn && window.__AutoApplyHUD) {
                        window.__AutoApplyHUD.highlightElement(btn, false);
                        window.__AutoApplyHUD.show("🎉 Form filled! Review details & click submit whenever ready.", "info");
                    }
                }""")

        job["last_updated"] = datetime.utcnow().isoformat()
        
        # Save updated queue
        queue = self.load_queue()
        for idx, q_item in enumerate(queue):
            if q_item["id"] == job["id"]:
                queue[idx] = job
                break
        self.save_queue(queue)

        await self.emit("job_completed", {"job": job, "stats": stats})
