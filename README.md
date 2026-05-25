# Vibe Coding IDE

Lightweight local coding environment using a Django backend (project under `vibe_backend/`) that provides code-execution and chat endpoints. The frontend is a static HTML/JS app (`index_final_with_clock.html`) enhanced with Monaco editor and a notes panel.

## What this repo contains
- `vibe_backend/` — Django project and app (use `manage.py` to run/manage).
- `index_final_with_clock.html`, `app_enhanced_with_clock.js`, `style_enhanced_with_clock.css` — Frontend UI (Monaco editor, terminal, chat, notes panel).
- `run_django.bat` — Windows convenience script to run the Django dev server.

## Requirements
- Python 3.10+ recommended.
- See `requirements.txt` for Python packages used by the Django and Flask components.

## Quick start (Windows / PowerShell)

1. Create and activate a virtual environment (recommended):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install Python dependencies:

```powershell
pip install -r requirements.txt
```

3. Run the Django backend (default port 8000):

```powershell
# From repository root
python .\vibe_backend\manage.py runserver
# Or run the convenience batch script
.\run_django.bat
```

4. Set the OpenAI API key (server-side only). Recommended: use the Django management command which writes the key into a local `.env` file used by the Django process.

```powershell
# Interactive prompt
python .\vibe_backend\manage.py set_openai_key

# Or pass the key directly (safer to avoid placing the key in shell history):
python .\vibe_backend\manage.py set_openai_key --key "sk-..."
```

This command writes a `.env` file next to `manage.py` (e.g. `vibe_backend/.env`) with `OPENAI_API_KEY=...`. The project includes `.gitignore` entries to avoid committing `.env`. For production deployments prefer a secrets manager or environment configuration supplied by your hosting provider — do not commit secrets to source control.

5. Run the Django backend (default port 8000):

```powershell
# From repository root
python .\vibe_backend\manage.py runserver
# Or run the convenience batch script
.\run_django.bat
```

6. Open the frontend in a browser:

```powershell
# Easiest: open the HTML file directly
start index_final_with_clock.html
# Or serve with a minimal HTTP server (recommended when using Monaco editor modules)
python -m http.server 5500
# then open http://localhost:5500/index_final_with_clock.html
```

## Notes feature
- A simple notes panel is available via the right sidebar `Notes` icon. Notes are saved to `localStorage` (key: `vibe_session_notes`) and persist in the browser. This is intentionally lightweight; if you want server-synced notes, see "Next steps" below.

## Security
- The executor endpoints run Python `exec` on submitted code. This is inherently dangerous — do not expose this service to untrusted networks or users. Consider sandboxing, resource limits, authentication, or removing arbitrary execution before any public deployment.

## Next steps / optional improvements
- Add server-backed storage for notes (Flask or Django endpoint). 
- Add authentication for both frontends and backends.
- Harden `app.py` with sandboxing, execution quotas, and input validation.
- Add keyboard shortcuts for toggling the notes panel.

## Contact / development
If you'd like, I can:
- Add a server-backed notes endpoint and sync implementation.
- Add keyboard shortcuts for notes toggling.
- Pin exact package versions in `requirements.txt` after you test locally.

---
Generated automatically by the project helper.