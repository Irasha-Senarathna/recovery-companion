# coach/

Stateless AI coping-coach service (milestone 9): a safety layer in front of a
local Ollama model. It is separate from `server/`, has no database or volume,
and never stores or logs message text.

```
POST /coach  {"lang": "en|si|ta", "message": "...", "history": [{"role": "user|coach", "text": "..."}]}
→ {"kind": "reply|crisis|refusal|fallback", "topic": null|"dosing"|..., "text": null|"...", "note": null|"reach_out"}
```

Pipeline (`app/pipeline.py`): crisis check (`crisis.py`, shared word list in
`content/crisis_terms.json`) → topic guard (`topic_guard.py`) → Ollama
(`ollama_client.py`, system prompt in `prompts.py`) → output checker
(`output_checker.py`). Only `reply` carries model text.

- Run: `make up` (port 8001). Needs Ollama on the Mac with the model pulled:
  `ollama pull qwen2.5:7b` (or set `COACH_MODEL` in `.env`).
- Local run without Docker: `cd coach && uv run uvicorn app.main:app --port 8001 --no-access-log`
- Tests: `make test-coach` (Ollama is mocked) · lint: `make lint-coach`
- Safety eval: `make safety-eval` (scripted model) or `make safety-eval ARGS="--live"`
