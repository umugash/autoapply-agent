import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, Callable
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

class BrowserController:
    """
    Manages the Playwright browser session, user-agent stealth, page navigation,
    highlighter injection, and human-in-the-loop pause/resume flow.
    """
    def __init__(self, headless: bool = False):
        self.headless = headless
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.highlighter_js_path = Path(__file__).resolve().parent / "highlighter.js"
        self.highlighter_script = ""
        self._load_highlighter()

        # Pause/Resume event
        self.resume_event = asyncio.Event()
        self.is_paused = False
        self.pause_reason = ""

    def _load_highlighter(self):
        if self.highlighter_js_path.exists():
            with open(self.highlighter_js_path, "r", encoding="utf-8") as f:
                self.highlighter_script = f.read()

    async def start(self):
        """Initializes Playwright browser with realistic anti-detection settings."""
        if not self.browser:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                    "--no-sandbox"
                ]
            )
            self.context = await self.browser.new_context(
                viewport={"width": 1440, "height": 900},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            # Inject stealth evasion
            await self.context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            """)
            self.page = await self.context.new_page()

    async def close(self):
        """Closes browser session."""
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            print(f"[BrowserController] Error closing browser: {e}")
        finally:
            self.page = None
            self.context = None
            self.browser = None
            self.playwright = None

    async def navigate_to(self, url: str) -> bool:
        """Navigates to URL and injects the highlighter HUD."""
        if not self.page:
            await self.start()
        try:
            await self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
            await self.page.wait_for_timeout(1500)
            await self.inject_highlighter()
            return True
        except Exception as e:
            print(f"[BrowserController] Navigation failed to {url}: {e}")
            return False

    async def inject_highlighter(self):
        """Injects visual highlighter script into the page."""
        if self.page and self.highlighter_script:
            try:
                await self.page.evaluate(self.highlighter_script)
            except Exception as e:
                print(f"[BrowserController] Highlighter injection warning: {e}")

    async def check_for_human_intervention(self) -> Optional[str]:
        """
        Runs client-side detection to see if OTP, CAPTCHA, or Login is on screen.
        Returns 'captcha', 'otp', 'login', or None.
        """
        if not self.page:
            return None
        try:
            intervention = await self.page.evaluate("() => window.__AutoApplyHUD ? window.__AutoApplyHUD.detectInterventions() : null")
            return intervention
        except Exception:
            return None

    async def trigger_intervention(self, reason: str, message: str, on_status_update: Optional[Callable] = None):
        """
        Halts the automated loop, informs the user via the browser HUD,
        and waits until the user clicks 'Resume' or solves the challenge.
        """
        self.is_paused = True
        self.pause_reason = reason
        self.resume_event.clear()

        # Update HUD in browser
        if self.page:
            escaped_msg = message.replace('"', '\\"').replace("'", "\\'")
            await self.page.evaluate(f'window.__AutoApplyHUD && window.__AutoApplyHUD.show("{escaped_msg}", "intervention")')

        if on_status_update:
            await on_status_update({
                "status": "waiting_for_user",
                "reason": reason,
                "message": message
            })

        # Poll for on-screen HUD button or backend resume
        while not self.resume_event.is_set():
            if self.page:
                try:
                    signal = await self.page.evaluate("window.__AUTOAPPLY_SIGNAL__")
                    if signal in ["resume", "skip"]:
                        await self.page.evaluate("window.__AUTOAPPLY_SIGNAL__ = null")
                        self.resume()
                        break
                except Exception:
                    pass
            await asyncio.sleep(0.8)

        self.is_paused = False
        if self.page:
            try:
                await self.page.evaluate("window.__AutoApplyHUD && window.__AutoApplyHUD.removeHighlights()")
            except Exception:
                pass

    def resume(self):
        """Resumes agent from paused intervention state."""
        self.is_paused = False
        self.resume_event.set()

    async def extract_page_text_and_title(self) -> Dict[str, str]:
        """Extracts job posting title and main text content for resume matching."""
        if not self.page:
            return {"title": "", "text": ""}
        try:
            title = await self.page.title()
            
            # Prefer standard job title headers
            job_header = await self.page.query_selector("h1, [data-automation-id*='jobTitle'], .job-title, .posting-headline")
            if job_header:
                title_text = await job_header.inner_text()
                if title_text.strip():
                    title = title_text.strip()

            body_text = await self.page.evaluate("""() => {
                const el = document.querySelector('.job-description, .posting-requirements, [data-automation-id*="jobDescription"], article, main') || document.body;
                return el.innerText;
            }""")
            return {"title": title, "text": body_text[:6000]}
        except Exception as e:
            print(f"[BrowserController] Error extracting page text: {e}")
            return {"title": "", "text": ""}
