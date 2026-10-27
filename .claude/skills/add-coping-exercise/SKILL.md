---
name: add-coping-exercise
description: Add a guided coping exercise (breathing, grounding, urge surfing, distraction) to the Craving SOS library, with translations and tests.
argument-hint: "[exercise type] [short idea]"
---

Add a coping exercise: $ARGUMENTS

1. Write the exercise as data in `content/exercises/<id>.json`:
   - `id`, `type` (breathing | grounding | urge-surfing | distraction | reach-out)
   - `duration_seconds`, and a list of `steps` (text key + seconds + optional animation)
   - Keep it general wellbeing guidance only. No medical claims, no substance-specific advice.
2. Add all text to the i18n files for English, Sinhala and Tamil.
   Mark Sinhala/Tamil as `"needs_review": true` so a native speaker checks them.
3. Wording: calm, short sentences, kind, no shame, no promises ("this will cure").
4. Make sure the help button stays visible on the exercise screen.
5. Tests: the exercise loads, every step has text in all languages, timings add up.
6. Run the `safety-reviewer` subagent on the new content and fix any findings.
