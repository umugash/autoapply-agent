import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

class ResumeMatcher:
    """
    Intelligently analyzes job descriptions and selects the most suitable resume
    from the user's multi-resume portfolio.
    """
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            self.data_dir = Path(__file__).resolve().parent.parent / "data"
        else:
            self.data_dir = Path(data_dir)
            
        self.resumes_meta_path = self.data_dir / "resumes.json"
        self.resumes_dir = self.data_dir / "resumes"
        self.resumes_dir.mkdir(parents=True, exist_ok=True)
        self.resumes: List[Dict[str, Any]] = []
        self.load()

    def load(self):
        """Loads resumes metadata from JSON."""
        if self.resumes_meta_path.exists():
            with open(self.resumes_meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.resumes = data.get("resumes", [])
        else:
            self.resumes = []

    def save(self):
        """Saves resumes metadata to JSON."""
        with open(self.resumes_meta_path, "w", encoding="utf-8") as f:
            json.dump({"resumes": self.resumes}, f, indent=2)

    @staticmethod
    def clean_text(text: str) -> str:
        text = text.lower()
        return re.sub(r"[^a-z0-9\s]", " ", text)

    def extract_keywords(self, text: str) -> set:
        stopwords = {
            "the", "and", "a", "an", "in", "on", "of", "to", "for", "with", "at", "by", "from",
            "as", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does",
            "did", "will", "would", "shall", "should", "can", "could", "may", "might", "must",
            "about", "into", "through", "during", "before", "after", "above", "below", "up", "down",
            "we", "you", "they", "our", "your", "their", "this", "that", "these", "those"
        }
        words = self.clean_text(text).split()
        return {w for w in words if len(w) > 2 and w not in stopwords}

    def match(self, job_title: str, job_description: str) -> Dict[str, Any]:
        """
        Calculates match score between the job posting and each available resume.
        Returns the winning resume and a complete breakdown.
        """
        if not self.resumes:
            return {
                "selected_resume": None,
                "score": 0,
                "reason": "No resumes registered in knowledge base.",
                "all_scores": []
            }

        jd_text = f"{job_title} {job_description}".lower()
        jd_keywords = self.extract_keywords(jd_text)
        title_keywords = self.extract_keywords(job_title)

        scored_candidates = []

        for resume in self.resumes:
            # 1. Role title match (Weight: 40%)
            role_matches = 0
            for target_role in resume.get("target_roles", []):
                role_words = self.extract_keywords(target_role)
                if role_words and role_words.issubset(title_keywords):
                    role_matches += 1.0
                elif any(w in title_keywords for w in role_words):
                    role_matches += 0.5
            role_score = min(1.0, role_matches) * 40.0

            # 2. Skill match (Weight: 40%)
            skills = resume.get("primary_skills", [])
            matched_skills = []
            for skill in skills:
                # Direct regex search for exact skill word
                pattern = r"\b" + re.escape(skill.lower()) + r"\b"
                if re.search(pattern, jd_text):
                    matched_skills.append(skill)
            skill_score = (len(matched_skills) / max(len(skills), 1)) * 40.0

            # 3. Resume keywords density (Weight: 20%)
            res_kw = set(self.clean_text(" ".join(resume.get("keywords", []))).split())
            matched_kw = res_kw.intersection(jd_keywords)
            kw_score = (len(matched_kw) / max(len(res_kw), 1)) * 20.0

            total_score = round(role_score + skill_score + kw_score, 1)

            # Resolve absolute file path
            relative_path = resume.get("filepath", "")
            abs_path = (self.data_dir / relative_path).resolve()
            if not abs_path.exists():
                # Check directly in resumes_dir by filename
                candidate_path = self.resumes_dir / resume.get("filename", "")
                if candidate_path.exists():
                    abs_path = candidate_path

            scored_candidates.append({
                "id": resume.get("id"),
                "filename": resume.get("filename"),
                "filepath": str(abs_path),
                "exists": abs_path.exists(),
                "total_score": total_score,
                "role_score": round(role_score, 1),
                "skill_score": round(skill_score, 1),
                "matched_skills": matched_skills,
                "summary": resume.get("summary", "")
            })

        # Sort highest score first
        scored_candidates.sort(key=lambda x: x["total_score"], reverse=True)
        winner = scored_candidates[0]

        reason = (
            f"Selected '{winner['filename']}' ({winner['total_score']}% match). "
            f"Matched key skills: {', '.join(winner['matched_skills'][:5]) if winner['matched_skills'] else 'Profile keyword alignment'}."
        )

        return {
            "selected_resume": winner,
            "score": winner["total_score"],
            "reason": reason,
            "all_scores": scored_candidates
        }

    def add_resume(self, filename: str, target_roles: List[str], skills: List[str], summary: str, keywords: Optional[List[str]] = None) -> Dict[str, Any]:
        """Registers a new resume profile."""
        resume_id = f"res_{len(self.resumes) + 1}"
        new_resume = {
            "id": resume_id,
            "filename": filename,
            "filepath": f"resumes/{filename}",
            "target_roles": target_roles,
            "primary_skills": skills,
            "summary": summary,
            "keywords": keywords or [k.lower() for k in skills + target_roles]
        }
        self.resumes.append(new_resume)
        self.save()
        return new_resume

    def delete_resume(self, resume_id: str) -> bool:
        """Removes a resume by id and cleans up the file if possible."""
        initial_count = len(self.resumes)
        target = next((r for r in self.resumes if r.get("id") == resume_id), None)
        if not target:
            return False

        # Attempt to remove underlying file if it exists
        filename = target.get("filename")
        if filename:
            file_path = self.resumes_dir / filename
            if file_path.exists():
                try:
                    file_path.unlink()
                except Exception as e:
                    print(f"[Matcher] Error deleting file {file_path}: {e}")

        self.resumes = [r for r in self.resumes if r.get("id") != resume_id]
        self.save()
        return len(self.resumes) < initial_count

