import os
import sys
import webbrowser
import time
from pathlib import Path
import uvicorn

if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    backend_dir = base_dir / "backend"
    sys.path.insert(0, str(backend_dir))
    
    print("\n" + "=" * 60)
    print("  🚀 Antigravity AutoApply AI Agent is Launching...")
    print("  🌐 Dashboard: http://127.0.0.1:8000")
    print("=" * 60 + "\n")

    # Open dashboard in browser after slight delay
    def open_browser():
        time.sleep(1.2)
        webbrowser.open("http://127.0.0.1:8000")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
