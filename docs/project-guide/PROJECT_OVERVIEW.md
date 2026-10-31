# Project overview

[Handbook home](README.md) · Next: [Features](FEATURES.md)

## In one sentence

Recovery Companion is a privacy-first Android app that helps people recovering from
drug addiction cope in the days **between** treatment sessions, without their
personal data leaving the phone.

It does **not** replace treatment. It is designed never to give medical advice.

## The problem

Treatment for drug addiction usually means a session every few days or weeks. The
hard moments come in between: a strong craving late at night, a stressful day at
work, a slip that brings shame. In those moments a person needs something quick
and kind, and they need to trust that nobody else will see it.

Three things make this hard to build well:

1. **Stigma and risk.** Data about drug use can harm a person if it leaks: with
   family, an employer or the law. So the app must keep data private by design, not
   by promise.
2. **Safety.** A wrong answer about medicines or withdrawal can be dangerous. A
   person in crisis needs help resources at once, not a chat.
3. **Shame.** Many apps count "days clean" and reset to zero after a slip. That
   can push people away at the moment they most need support.

## Objectives

| Objective | How the project meets it |
|---|---|
| Help in a craving, fast | One big **SOS** button opens a guided exercise in two taps |
| Help people notice their own warning signs | A 20-second daily check-in feeds a personal **trigger map** and gentle early warnings |
| Keep personal data private | Everything is stored **encrypted on the phone**. The server sees only random IDs |
| Make asking for help easy | A trusted person can be asked to "please check in", with **no details** shared |
| Never shame | A slip never resets progress ("You have 45 strong days. They are still yours.") |
| Be safe | No medical advice anywhere, a help button on every screen, crisis words show help at once |
| Be honest about AI | The coach is optional and guarded. The risk model is trained only on synthetic data, and the app says so |
| Zero cost | Free tools only: Expo, FastAPI, Postgres, Ollama, GitHub Actions, EAS free tier |

## Target users

| User | Needs |
|---|---|
| **A person in recovery** (the "member") | Quick coping help, a private place for check-ins, a way to reach a trusted person, progress that survives a slip |
| **A trusted person** (the "supporter") | To know when to check in, without being told private details. They use the same app in **supporter mode** |
| **Treatment professionals** (indirect) | The app sends people back to them for anything medical, and the finder lists treatment places |

The project targets **Sri Lanka**: the app is in English, Sinhala and Tamil, and the
help contacts and support places come from Sri Lankan official sources (checked by
hand, see [Safety and privacy](SAFETY_AND_PRIVACY.md#helpline-numbers)).

## What kind of project this is

- A **portfolio project**, built in 11 milestones ([roadmap](PROJECT_ROADMAP.md)).
- **Demo and synthetic data only.** It has not been used with real patients. Using it
  with real people would need a treatment partner, clinical review and ethics approval.
- **Android first.** iOS is not built. The app also runs in a web browser for
  development, with clearly labelled stand-ins for phone-only features.

## Guiding rules

The project's `CLAUDE.md` sets rules that every change must follow. In short:

**Safety:** no medical, dosing, drug-use, tapering or withdrawal advice · a help button
on every screen · helpline numbers only from a hand-verified file · crisis words show
help at once · no shame language · demo data only.

**Privacy:** data stays on the device, encrypted · the server sees only what the user
chooses to share · no real names · app lock and quick-hide · no analytics or ad SDKs.

These rules are checked by automated tests, described in
[Testing and CI/CD](TESTING_AND_CI_CD.md).

## Related pages

- [Features](FEATURES.md): what the app does
- [System architecture](SYSTEM_ARCHITECTURE.md): how it is built
- [Safety and privacy](SAFETY_AND_PRIVACY.md): how users are protected
