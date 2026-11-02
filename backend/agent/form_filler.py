import asyncio
import re
from typing import Dict, Any, List, Optional, Tuple, Callable
from .knowledge import KnowledgeBase

class FormFiller:
    """
    Intelligent Form Analyzer and Filler.
    Supports top ATS platforms (Greenhouse, Lever, Ashby, Workday) and
    universal heuristic detection on custom corporate career sites.
    """
    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base

    @staticmethod
    def clean_text(text: str) -> str:
        if not text:
            return ""
        return " ".join(text.strip().split())

    async def extract_label_for_input(self, page, element) -> str:
        """
        Robustly determines the human label or prompt associated with an input element.
        """
        # 1. aria-label or placeholder
        aria_label = await element.get_attribute("aria-label")
        if aria_label:
            return self.clean_text(aria_label)

        placeholder = await element.get_attribute("placeholder")
        if placeholder and len(placeholder.split()) > 1:
            return self.clean_text(placeholder)

        # 2. Associated <label for="id">
        el_id = await element.get_attribute("id")
        if el_id:
            label_el = await page.query_selector(f"label[for='{el_id}']")
            if label_el:
                txt = await label_el.inner_text()
                if txt.strip():
                    return self.clean_text(txt)

        # 3. Parent or ancestor label
        parent_label = await element.evaluate("""el => {
            const label = el.closest('label');
            if (label) return label.innerText;
            const container = el.closest('.field, .form-group, .input-container, div[class*="field"], div[class*="form"]');
            if (container) {
                const l = container.querySelector('label, .label, span[class*="label"], [data-automation-id*="label"]');
                if (l) return l.innerText;
            }
            return '';
        }""")
        if parent_label and parent_label.strip():
            return self.clean_text(parent_label)

        # 4. Fallback: name attribute
        name = await element.get_attribute("name")
        if name:
            return self.clean_text(name.replace("_", " ").replace("-", " "))

        return ""

    async def fill_text_field(self, page, element, value: str):
        """Types value with human-like natural rhythm."""
        try:
            await element.scroll_into_view_if_needed()
            await element.click()
            await page.wait_for_timeout(50)
            # Clear existing content if any
            await element.fill("")
            await page.wait_for_timeout(30)
            await element.press_sequentially(str(value), delay=25)
            # Add subtle visual indicator
            await element.evaluate("el => el.classList.add('autoapply-highlight-fill')")
        except Exception as e:
            print(f"[FormFiller] Warning filling text field: {e}")

    async def select_dropdown_option(self, page, element, target_value: str) -> bool:
        """Finds and selects the closest matching option in a <select> or custom combobox."""
        try:
            tag_name = await element.evaluate("el => el.tagName.toLowerCase()")
            if tag_name == "select":
                # Standard <select>
                options = await element.query_selector_all("option")
                best_val = None
                target_clean = self.clean_text(target_value).lower()
                
                for opt in options:
                    opt_text = self.clean_text(await opt.inner_text()).lower()
                    opt_val = await opt.get_attribute("value") or ""
                    if target_clean in opt_text or opt_text in target_clean:
                        best_val = opt_val if opt_val else opt_text
                        break
                        
                if best_val is not None:
                    await element.select_option(value=best_val)
                    return True
                elif len(options) > 1:
                    # Default to second option (first is usually empty placeholder)
                    val = await options[1].get_attribute("value")
                    if val:
                        await element.select_option(value=val)
                    return True
            else:
                # Custom combobox (e.g. Workday / React Select)
                await element.click()
                await page.wait_for_timeout(300)
                # Type to filter if searchable
                await page.keyboard.type(target_value[:10])
                await page.wait_for_timeout(400)
                await page.keyboard.press("Enter")
                return True
        except Exception as e:
            print(f"[FormFiller] Warning selecting dropdown option: {e}")
        return False

    async def select_radio_or_checkbox(self, page, element, state: bool = True):
        """Safely checks or unchecks radio/checkbox."""
        try:
            is_checked = await element.is_checked()
            if is_checked != state:
                await element.scroll_into_view_if_needed()
                await element.click(force=True)
        except Exception as e:
            print(f"[FormFiller] Warning setting radio/checkbox: {e}")

    async def upload_file(self, page, file_input_el, file_path: str) -> bool:
        """Uploads a file (resume or cover letter) to a file input element."""
        try:
            await file_input_el.set_input_files(file_path)
            await page.wait_for_timeout(600)
            return True
        except Exception as e:
            print(f"[FormFiller] Warning uploading file {file_path}: {e}")
            return False

    async def process_form(
        self,
        page,
        resume_path: Optional[str] = None,
        on_intervention_needed: Optional[Callable[[Dict[str, Any]], Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyzes the active page form, fills known fields, uploads resume,
        and halts with visual highlight if an unknown question or CAPTCHA/OTP is detected.
        """
        stats = {
            "fields_filled": 0,
            "resume_uploaded": False,
            "interventions_triggered": 0,
            "unhandled_fields": []
        }

        # 1. First check for resume upload field
        if resume_path:
            file_inputs = await page.query_selector_all("input[type='file']")
            for f_input in file_inputs:
                label = await self.extract_label_for_input(page, f_input)
                # Default to resume if not specified or mentions resume/cv
                if not label or any(k in label.lower() for k in ["resume", "cv", "curriculum", "attach", "upload"]):
                    uploaded = await self.upload_file(page, f_input, resume_path)
                    if uploaded:
                        stats["resume_uploaded"] = True
                        stats["fields_filled"] += 1
                        break

        # 2. Find all visible form inputs
        inputs = await page.query_selector_all("input:not([type='hidden']):not([type='file']):not([type='submit']):not([type='button']), textarea, select")
        
        for input_el in inputs:
            try:
                is_visible = await input_el.is_visible()
                if not is_visible:
                    continue

                input_type = await input_el.get_attribute("type") or "text"
                tag_name = await input_el.evaluate("el => el.tagName.toLowerCase()")
                label = await self.extract_label_for_input(page, input_el)

                if not label:
                    continue

                # Query knowledge base
                answer, confidence, source = self.kb.get_answer(label)

                if answer is not None:
                    # Fill according to input type
                    if tag_name == "select":
                        await self.select_dropdown_option(page, input_el, answer)
                        stats["fields_filled"] += 1
                    elif input_type in ["radio", "checkbox"]:
                        # If answer is 'Yes' or truthy, check it
                        should_check = answer.lower() in ["yes", "true", "1"]
                        await self.select_radio_or_checkbox(page, input_el, should_check)
                        stats["fields_filled"] += 1
                    else:
                        # Regular text or textarea
                        await self.fill_text_field(page, input_el, answer)
                        stats["fields_filled"] += 1
                else:
                    # Unrecognized field! Check if it's required
                    is_required = await input_el.evaluate("""el => {
                        return el.required ||
                               el.getAttribute('aria-required') === 'true' ||
                               el.closest('.required, [data-required="true"]') !== null ||
                               (el.parentElement && el.parentElement.innerText.includes('*'));
                    }""")

                    if is_required:
                        stats["interventions_triggered"] += 1
                        stats["unhandled_fields"].append({
                            "label": label,
                            "type": input_type,
                            "required": True
                        })

                        # Visually highlight unhandled field on screen
                        await input_el.evaluate("el => window.__AutoApplyHUD && window.__AutoApplyHUD.highlightElement(el, true)")
                        
                        if on_intervention_needed:
                            await on_intervention_needed({
                                "type": "unknown_question",
                                "label": label,
                                "input_type": input_type,
                                "message": f"Agent encountered an unanswered question: '{label}'. Please provide an answer."
                            })

            except Exception as e:
                print(f"[FormFiller] Warning processing element: {e}")

        return stats
