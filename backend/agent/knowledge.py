import json
import os
import re
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

class KnowledgeBase:
    """
    Manages the user's personal details, profile settings, and dynamically
    learned Q&A memory for screening questions.
    """
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            self.data_dir = Path(__file__).resolve().parent.parent / "data"
        else:
            self.data_dir = Path(data_dir)
            
        self.profile_path = self.data_dir / "profile.json"
        self.learned_qa_path = self.data_dir / "learned_qa.json"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.profile: Dict[str, Any] = {}
        self.learned_qa: Dict[str, Any] = {"questions": []}
        self.load()

    def load(self):
        """Loads profile and learned QA from disk."""
        if self.profile_path.exists():
            with open(self.profile_path, "r", encoding="utf-8") as f:
                self.profile = json.load(f)
        else:
            self.profile = {}

        if self.learned_qa_path.exists():
            with open(self.learned_qa_path, "r", encoding="utf-8") as f:
                self.learned_qa = json.load(f)
        else:
            self.learned_qa = {"questions": []}

    def save_profile(self, new_profile: Dict[str, Any]):
        """Updates and persists the user profile."""
        self.profile = new_profile
        with open(self.profile_path, "w", encoding="utf-8") as f:
            json.dump(self.profile, f, indent=2)

    def save_learned_qa(self):
        """Persists learned QA memory to disk."""
        with open(self.learned_qa_path, "w", encoding="utf-8") as f:
            json.dump(self.learned_qa, f, indent=2)

    @staticmethod
    def normalize_text(text: str) -> str:
        """Lowercases, removes punctuation, and standardizes spacing."""
        text = text.lower()
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        return " ".join(text.split())

    def calculate_similarity(self, s1: str, s2: str) -> float:
        """Token-based Jaccard similarity between two strings."""
        tokens1 = set(self.normalize_text(s1).split())
        tokens2 = set(self.normalize_text(s2).split())
        if not tokens1 or not tokens2:
            return 0.0
        intersection = len(tokens1.intersection(tokens2))
        union = len(tokens1.union(tokens2))
        return intersection / union if union > 0 else 0.0

    def query_profile_field(self, field_name: str) -> Optional[str]:
        """
        Maps standard field names to user profile data.
        """
        norm = self.normalize_text(field_name)
        personal = self.profile.get("personal", {})
        links = self.profile.get("links", {})
        work_auth = self.profile.get("work_authorization", {})
        prefs = self.profile.get("preferences", {})
        demographics = self.profile.get("demographics", {})

        def has_word(word_list: List[str], text: str) -> bool:
            for w in word_list:
                if re.search(r'\b' + re.escape(w) + r'\b', text):
                    return True
            return False

        # 1. Legal, Authorization & Sponsorship checks (High priority)
        if any(w in norm for w in ["authorized to work", "legally authorized", "authorized in", "authorization"]):
            return work_auth.get("legally_authorized_us", "Yes")
        if any(w in norm for w in ["require sponsorship", "sponsorship now or", "visa sponsorship", "future sponsorship"]):
            return work_auth.get("require_sponsorship_now_or_future", "No")
        if any(w in norm for w in ["notice period", "how much notice", "start date", "availability"]):
            return prefs.get("notice_period", "2 weeks")
        if any(w in norm for w in ["desired salary", "compensation expectation", "expected salary"]):
            return prefs.get("desired_salary", "150000")

        # 2. Direct name mappings
        if any(w in norm for w in ["first name", "firstname", "given name"]):
            return personal.get("first_name", "")
        if any(w in norm for w in ["last name", "lastname", "surname", "family name"]):
            return personal.get("last_name", "")
        if any(w in norm for w in ["full name", "your name", "applicant name"]) and "first" not in norm and "last" not in norm:
            return personal.get("full_name", f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip())
        if has_word(["email", "e-mail"], norm):
            return personal.get("email", "")
        if has_word(["phone", "telephone", "mobile", "contact number"], norm):
            return personal.get("phone", "")
        if has_word(["linkedin"], norm):
            return links.get("linkedin", "")
        if has_word(["github"], norm):
            return links.get("github", "")
        if any(w in norm for w in ["portfolio", "personal website", "website", "blog"]):
            return links.get("portfolio", "")
        if has_word(["twitter"], norm):
            return links.get("twitter", "")

        # 3. Address fields (Explicitly ignore "united states")
        if any(w in norm for w in ["street address", "address line", "street"]):
            return personal.get("address", "")
        if has_word(["city", "town"], norm):
            return personal.get("city", "")
        if has_word(["postal", "zip", "zipcode", "postcode"], norm):
            return personal.get("postal_code", "")
        if has_word(["state", "province", "region"], norm) and "united states" not in norm and "states" not in norm:
            return personal.get("state", "")
        if has_word(["country", "nation"], norm):
            return personal.get("country", "")
        if any(w in norm for w in ["salary", "desired salary", "compensation"]):
            return prefs.get("desired_salary", "150000")

        # Demographics
        if any(w in norm for w in ["gender"]):
            return demographics.get("gender", "Decline to self-identify")
        if any(w in norm for w in ["veteran"]):
            return demographics.get("veteran_status", "I am not a protected veteran")
        if any(w in norm for w in ["disability"]):
            return demographics.get("disability_status", "No, I do not have a disability")

        return None

    def find_learned_answer(self, question_text: str, threshold: float = 0.45) -> Tuple[Optional[str], float]:
        """
        Searches learned Q&A memory for the best match using pattern matching & token similarity.
        """
        norm_q = self.normalize_text(question_text)
        best_match = None
        best_score = 0.0

        for item in self.learned_qa.get("questions", []):
            patterns = item.get("patterns", [])
            for pattern in patterns:
                norm_p = self.normalize_text(pattern)
                # Exact or substring match gets highest score
                if norm_p == norm_q:
                    return item.get("answer"), 1.0
                if norm_p in norm_q or norm_q in norm_p:
                    score = 0.90
                    if score > best_score:
                        best_score = score
                        best_match = item.get("answer")
                    continue

                # Jaccard token similarity
                sim = self.calculate_similarity(norm_q, norm_p)
                if sim > best_score:
                    best_score = sim
                    best_match = item.get("answer")

        if best_score >= threshold:
            return best_match, best_score

        return None, best_score

    def get_answer(self, question_text: str) -> Tuple[Optional[str], float, str]:
        """
        Unified resolver:
        1. Checks profile fields.
        2. Checks learned Q&A memory.
        Returns: (answer, confidence, source)
        """
        # 1. Profile field check
        profile_ans = self.query_profile_field(question_text)
        if profile_ans:
            return profile_ans, 0.95, "profile"

        # 2. Learned QA check
        learned_ans, score = self.find_learned_answer(question_text)
        if learned_ans and score >= 0.45:
            return learned_ans, score, "learned_memory"

        return None, 0.0, "unknown"

    def learn_question(self, question_text: str, answer: str, field_type: str = "text", category: str = "custom") -> Dict[str, Any]:
        """
        Dynamically records a newly answered question into memory so it's
        never asked to the user again.
        """
        norm = self.normalize_text(question_text)
        # Check if an existing entry matches closely
        for item in self.learned_qa.get("questions", []):
            for pattern in item.get("patterns", []):
                if self.normalize_text(pattern) == norm or self.calculate_similarity(norm, self.normalize_text(pattern)) > 0.8:
                    item["answer"] = answer
                    if norm not in [self.normalize_text(p) for p in item["patterns"]]:
                        item["patterns"].append(question_text)
                    self.save_learned_qa()
                    return item

        # New question entry
        new_id = f"q_custom_{len(self.learned_qa.get('questions', [])) + 1}"
        new_entry = {
            "id": new_id,
            "patterns": [question_text],
            "answer": answer,
            "type": field_type,
            "category": category,
            "confidence": 1.0,
            "auto_learned": True
        }
        self.learned_qa["questions"].append(new_entry)
        self.save_learned_qa()
        return new_entry
