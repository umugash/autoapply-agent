import os
import sys
import json
import asyncio
from pathlib import Path

# Ensure backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent.knowledge import KnowledgeBase
from agent.matcher import ResumeMatcher
from agent.runner import AgentRunner

app = FastAPI(title="Antigravity AutoApply AI Agent", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
FRONTEND_DIR = BASE_DIR.parent / "frontend"

# Initialize singletons
kb = KnowledgeBase(data_dir=str(DATA_DIR))
matcher = ResumeMatcher(data_dir=str(DATA_DIR))
runner = AgentRunner(data_dir=str(DATA_DIR), headless=False)

# Connected WebSocket clients
active_websockets: List[WebSocket] = []

async def broadcast_ws(event: Dict[str, Any]):
    """Broadcasts event to all connected dashboard clients."""
    disconnected = []
    for ws in active_websockets:
        try:
            await ws.send_json(event)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in active_websockets:
            active_websockets.remove(ws)

# Hook runner events to WebSocket
runner.subscribe(broadcast_ws)

# Pydantic Request Models
class LinksInput(BaseModel):
    urls: List[str]

class QuestionAnswerInput(BaseModel):
    question: str
    answer: str
    category: Optional[str] = "custom"

class MatcherTestInput(BaseModel):
    job_title: str
    job_description: str

class ProfileUpdateInput(BaseModel):
    profile: Dict[str, Any]

# API Endpoints
@app.get("/api/profile")
def get_profile():
    kb.load()
    return kb.profile

@app.post("/api/profile")
def update_profile(body: ProfileUpdateInput):
    kb.save_profile(body.profile)
    return {"status": "success", "profile": kb.profile}

@app.get("/api/resumes")
def get_resumes():
    matcher.load()
    return {"resumes": matcher.resumes}

@app.post("/api/resumes")
async def upload_resume(
    file: UploadFile = File(...),
    target_roles: str = Form(...),
    primary_skills: str = Form(...),
    summary: str = Form(...)
):
    upload_folder = DATA_DIR / "resumes"
    upload_folder.mkdir(parents=True, exist_ok=True)
    file_path = upload_folder / file.filename
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    roles_list = [r.strip() for r in target_roles.split(",") if r.strip()]
    skills_list = [s.strip() for s in primary_skills.split(",") if s.strip()]
    
    new_res = matcher.add_resume(
        filename=file.filename,
        target_roles=roles_list,
        skills=skills_list,
        summary=summary
    )
    return {"status": "success", "resume": new_res}

@app.post("/api/matcher/test")
def test_matcher(body: MatcherTestInput):
    res = matcher.match(body.job_title, body.job_description)
    return res

@app.get("/api/learned-qa")
def get_learned_qa():
    kb.load()
    return kb.learned_qa

@app.post("/api/learned-qa")
def add_or_update_qa(body: QuestionAnswerInput):
    item = kb.learn_question(body.question, body.answer, category=body.category or "custom")
    return {"status": "success", "item": item}

@app.delete("/api/learned-qa/{qa_id}")
def delete_learned_qa(qa_id: str):
    kb.load()
    initial_len = len(kb.learned_qa.get("questions", []))
    kb.learned_qa["questions"] = [q for q in kb.learned_qa.get("questions", []) if q.get("id") != qa_id]
    if len(kb.learned_qa["questions"]) < initial_len:
        kb.save_learned_qa()
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Question ID not found")

@app.get("/api/queue")
def get_queue():
    return {"queue": runner.load_queue()}

@app.post("/api/queue")
def add_to_queue(body: LinksInput):
    added = runner.add_to_queue(body.urls)
    return {"status": "success", "added": added, "count": len(added)}

@app.delete("/api/queue/{job_id}")
def delete_from_queue(job_id: str):
    queue = runner.load_queue()
    new_queue = [j for j in queue if j.get("id") != job_id]
    runner.save_queue(new_queue)
    return {"status": "success"}

@app.post("/api/runner/start")
async def start_runner(auto_submit: bool = False):
    if runner.is_running:
        return {"status": "already_running"}
    # Run in background asyncio task
    asyncio.create_task(runner.run_next_in_queue(auto_submit=auto_submit))
    return {"status": "started"}

@app.post("/api/runner/stop")
async def stop_runner():
    await runner.stop()
    return {"status": "stopped"}

@app.post("/api/runner/resume")
async def resume_runner():
    await runner.resume_intervention()
    return {"status": "resumed"}

@app.post("/api/runner/answer")
async def answer_intervention_question(body: QuestionAnswerInput):
    await runner.answer_pending_question(body.question, body.answer)
    return {"status": "answered_and_resumed"}

@app.get("/api/status")
def get_runner_status():
    return {
        "is_running": runner.is_running,
        "is_paused": runner.browser.is_paused,
        "pause_reason": runner.browser.pause_reason,
        "current_job_id": runner.current_job_id
    }

# WebSocket Endpoint for real-time live events
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        # Send current state on connection
        await websocket.send_json({
            "type": "connection_established",
            "data": {
                "is_running": runner.is_running,
                "is_paused": runner.browser.is_paused,
                "current_job_id": runner.current_job_id
            }
        })
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            if action == "resume":
                await runner.resume_intervention()
            elif action == "answer":
                q = data.get("question")
                a = data.get("answer")
                if q and a:
                    await runner.answer_pending_question(q, a)
            elif action == "start":
                asyncio.create_task(runner.run_next_in_queue())
            elif action == "stop":
                await runner.stop()
    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
    except Exception as e:
        print(f"[WS Error]: {e}")
        if websocket in active_websockets:
            active_websockets.remove(websocket)

# Mount frontend directory for Web Dashboard UI
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
