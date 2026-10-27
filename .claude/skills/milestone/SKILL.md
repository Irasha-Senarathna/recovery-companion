---
name: milestone
description: Build one project milestone end to end (plan, tests first, implement, verify, review, summarize). Use when the user says "start milestone N".
disable-model-invocation: true
argument-hint: "[milestone number or name]"
---

Build milestone: $ARGUMENTS

Follow these steps in order. Do not skip any.

1. **Understand.** Read `CLAUDE.md` (especially the safety and privacy rules) and
   `docs/plan.md`. Find this milestone's goal and acceptance criteria.
   If anything is unclear, ask the user before writing code.
2. **Plan.** Show a short checklist of the files you will create or change.
3. **Tests first.** Write tests for the acceptance criteria. Run them; they should fail.
4. **Implement.** Write the smallest code that makes the tests pass.
5. **Verify.** Run `make lint` and `make test`. Fix every failure.
   If the AI coach changed, also run `make safety-eval` and report the results.
6. **Review.**
   - Screens, text, notifications or AI coach changed → `safety-reviewer` subagent.
   - Storage, server, sync, auth or notifications changed → `privacy-reviewer` subagent.
   Fix all Critical and High findings.
7. **Docs.** Update `docs/` and mark the milestone status in `docs/plan.md`.
8. **Summary.** Tell the user what was built, how to try it (exact commands and
   which screen to open), test results, and a suggested git commit message.
