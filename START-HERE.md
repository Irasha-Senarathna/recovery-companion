# Start Here — Recovery Companion starter kit

This kit sets up Claude Code to build a safe, private recovery-support app.
Read this page once, then follow `PROMPTS.md`.

---

## What is in this kit (in simple words)

| File | What it is | Why you need it |
|---|---|---|
| `CLAUDE.md` | Project memory | Claude reads it every session: the app, the stack, and the **safety and privacy rules**. |
| `PROMPTS.md` | Step-by-step prompts | One prompt per milestone (0–11). Copy, paste, run, commit. |
| `.claude/settings.json` | Hooks config | Turns on the two automatic hooks. |
| `.claude/hooks/protect_files.py` | Hook: protect files | Blocks Claude from editing `.env`, lock files, **`helplines.json` and `disclaimer.md`**. Only you edit those, after checking official sources. |
| `.claude/hooks/format_file.py` | Hook: auto-format | Formats every file after Claude edits it. |
| `.claude/agents/safety-reviewer.md` | Subagent | Checks screens, text and the AI coach for anything unsafe (medical advice, shaming words, missing help button). |
| `.claude/agents/privacy-reviewer.md` | Subagent | Checks that personal data stays on the phone, is encrypted, and is never leaked. |
| `.claude/agents/test-writer.md` | Subagent | Writes and runs tests. Can only edit test files. |
| `.claude/skills/milestone/` | Skill → `/milestone` | Runs one milestone the right way: plan → tests → code → verify → review → summary. |
| `.claude/skills/add-coping-exercise/` | Skill → `/add-coping-exercise` | Adds a breathing or grounding exercise in 3 languages. |
| `.claude/skills/add-safety-test/` | Skill → `/add-safety-test` | Adds test cases that check the AI coach behaves safely. |

**Hook** = an automatic rule Claude can't forget.
**Subagent** = a helper with one job and limited permissions.
**Skill** = a saved recipe you start with a slash command.

---

## One-time setup

1. **Install:** Git, Docker Desktop, Node.js 20+, Python 3.12, `pip install ruff`,
   Claude Code, and the **Expo Go** app on your phone (to test the app).
   For the optional AI coach: Ollama, then `ollama pull qwen2.5:3b` (or 7b with 16 GB RAM).
2. **Create the project and copy the kit in** (including the hidden `.claude` folder):
   ```bash
   mkdir recovery-companion && cd recovery-companion
   git init
   # copy the kit here, then check:
   ls -a        # you should see .claude
   ```
3. **Start Claude Code:** run `claude`, then check `/hooks`, `/agents`, and `/`.
4. **First commit:**
   ```bash
   git add -A && git commit -m "chore: add Claude Code starter kit"
   ```

---

## Your personal tasks (Claude can't do these for you)

1. **After Prompt 1:** fill in `content/helplines.json` and `content/disclaimer.md`
   using official sources (e.g. the NDDCB website, national emergency numbers).
   Add the date you checked them.
2. **Sinhala and Tamil text:** ask a native speaker to check text marked `needs_review`.
3. **Optional but valuable:** show your app design to a counsellor or someone working
   in recovery support, and ask for feedback. Mention this in your README.

---

## How to work, every day

1. Copy the **next** prompt from `PROMPTS.md` and paste it into Claude Code.
2. Answer any questions Claude asks.
3. Test it yourself on your phone with Expo Go.
4. `git commit` with the message Claude suggests.
5. Type `/clear`, then move to the next prompt.

If Claude goes the wrong way, press **Esc** to stop it or use `/rewind` to undo.

---

## Safety reminders for this project

- The app **supports** recovery. It never gives medical, dosing or drug-use advice.
- Use **fake demo data only**. Do not collect real people's data.
- If you ever want real users, partner with a treatment organisation and get
  ethics guidance first.

---

## Timeline (rough)

| Week | Milestones |
|---|---|
| 1 | 0–2: plan, scaffold, secure foundation |
| 2 | 3: Craving SOS |
| 3 | 4–5: check-ins, synthetic data, risk model |
| 4 | 6: support circle |
| 5 | 7–8: slips, goals, support finder |
| 6 | 9: AI coach + safety evals |
| 7 | 10–11: polish, CI/CD, README, demo video |

**Cost:** $0 inside the project (open-source tools, local AI, synthetic data).
Claude Code itself needs a paid Claude plan.
