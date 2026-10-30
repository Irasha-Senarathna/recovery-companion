# Privacy design and threat model — Recovery Companion

Status: **draft for approval**. Applies to all milestones. See `architecture.md`
for diagrams.

## Principles

1. **On the device by default.** Personal data is stored only on the phone,
   encrypted at rest (SQLCipher, key in the Android Keystore through
   `expo-secure-store`).
2. **Opt-in to leave the device.** Only two features send anything off the
   phone: the support circle and the AI coach. Both are off by default and
   both explain, before they are turned on, exactly what will be sent.
3. **Minimum data.** The server stores random IDs and "please check in"
   signals. It never sees names, phone numbers, check-ins, cravings,
   substances, slips or locations.
4. **No tracking.** No third-party analytics, crash reporting or ad SDKs.
   No logging of personal data, anywhere.
5. **Demo data only.** This is a portfolio project. Only synthetic or demo data
   is used. Collecting real user data would first need a partner treatment
   organisation and ethics guidance.
6. **User control.** App lock, quick-hide, and "delete all my data" that
   removes everything on the phone and on the server.

## Data inventory

### On the device (encrypted SQLite unless noted)

| Data | Feature | Sensitivity | Leaves device? | Retention | Deleted by |
|---|---|---|---|---|---|
| Nickname (no real name required) | Onboarding | Medium | No | Until deleted | Delete-all |
| Language, theme, notification settings | Settings | Low | No | Until deleted | Delete-all |
| App-lock PIN hash (salted) | App lock | High | No | Until changed | Delete-all |
| DB encryption key | Storage | Critical | No (secure store / Keystore) | App lifetime | Delete-all deletes the key |
| Circle API account ID + token | Support circle | High | Sent only to the circle API, as auth | Until circle is disabled | Leaving the circle / delete-all |
| Daily check-ins (mood, sleep, stress, craving; 0–4, one per local day) | Check-in | High | No | Until deleted | Delete-all |
| Tags (fixed list from `content/checkin.json`; no free text, no GPS) | Check-in, trigger map | High (e.g. "near a risky place") | No | Until deleted | Delete-all |
| Demo rows (`demo = 1`), development builds only | Dev menu | None (made up) | No | Until cleared | Dev menu "Clear" / delete-all |
| Craving SOS sessions (start, end, exercise, outcome) | Craving SOS | High | No | Until deleted | Delete-all |
| Reasons vault: text, photos, voice notes (BLOBs, size-limited: 500 chars, 1.5 MB photo, 2 MB / 60 s voice, 50 items) | Craving SOS | High | No | Until deleted (`secure_delete` overwrites removed items) | Per item / delete-all |
| Support person: name and phone number | Craving SOS | High (third-party data; reveals a confidant) | No. Tapping "Call" hands the number to the phone app, so the call appears in the OS call log | Until removed | Remove button in Settings / delete-all |
| Temporary unencrypted media: `cache/Audio` (recording), `cache/rc-voice` (playback copy), `cache/ImagePicker` (picker copy) | Craving SOS | High | No | Seconds: deleted right after use, swept at every launch | Immediately / launch sweep / delete-all |
| Microphone and photo-library access | Craving SOS | — (OS permission, no stored data) | The Android system photo picker sees which photo is chosen | Until revoked in OS settings | OS settings |
| Slips + gentle-question answers | Slips | Very high | No | Until deleted | Per item / delete-all |
| Goals, money saved, progress | Goals | Medium | No | Until deleted | Delete-all |
| Coping plan: early signs, what helps, who to contact (free text, ≤ 1000 chars each, crisis words open help) | Early warning | High (may name people) | No | Until changed | Delete-all |
| Risk score, reasons, trigger patterns | Trigger map | High | No. Computed on the phone from the user's own check-ins | **Not stored**: recomputed when a screen opens | Nothing to delete |
| Heads-up settings: on/off, time of today's heads-up | Early warning | Medium (the time hints at a harder day) | No | Until changed | Delete-all |
| Supporter local labels (e.g. "Sister") | Support circle | Medium | **No.** The label exists only on the phone that set it | Until removed | Revoke / delete-all |
| Coach chat history | AI coach | Very high | Current turns are sent to the coach service when enabled | **Not stored by default.** Optional on-device history | Clear chat / delete-all |
| Daily check-in reminder: on/off and time (settings); one scheduled local notification `daily-checkin` with fixed neutral text | Check-in | Medium (lock screen) | No: scheduled by the phone itself, no push service | Until turned off | Settings toggle / delete-all cancels it |
| Scheduled heads-up `early-warning` (one-time, ≤ 1 a day, never 22:00–08:00, neutral text) | Early warning | Medium: its arrival itself hints at a harder day (said in the toggle's note). Android hides the text on a secure lock screen; iOS shows it unless the user picks "Show Previews: When Unlocked" | No: scheduled by the phone itself | Until fired, cancelled or no longer a harder day | Toggle off / delete-all cancels it and removes its channel |

### On the support-circle server (Postgres, laptop, only if circle is enabled)

| Column / item | Why it is needed | Retention |
|---|---|---|
| `account.id` (random UUID) | Identify a device | Until account deleted |
| `account.token_hash` (SHA-256 of a 256-bit random token) | Authentication | Until account deleted |
| `account.role` (member / supporter) | Authorisation | Until account deleted |
| `account.created_at` | Abuse limits | Until account deleted |
| `invite.code_hash`, `expires_at`, `used_at`, `member_id` | Invite flow (single use, 24 h expiry) | Deleted at use or expiry |
| `link.member_id`, `supporter_id`, `status`, `created_at` | Who may receive whose signals (max 3) | Until revoked |
| `signal.id`, `member_id`, `created_at` | "Please check in on me" | **Auto-deleted after 7 days** |
| `push_token.account_id`, `token` | Deliver a neutral push to supporters | Until account deleted or token rotated |

There are no columns for names, phone numbers, emails, free text, locations or
health data. **A schema allow-list test** fails the build if anyone adds one.

### On the coach service (laptop, only if coach is enabled)

| Item | Handling |
|---|---|
| Current message + last ≤ 6 turns | Processed in memory and discarded after the reply. Never written to disk or a DB. |
| Request logs | Method, path, status and latency only. **Bodies are never logged.** A test checks this. |
| Ollama | Runs locally. Ollama does not keep a chat history for API calls. |

### Third parties

| Party | Receives | Mitigation |
|---|---|---|
| Expo push service + Firebase Cloud Messaging | Supporter push token and the notification text | Text is fixed and neutral ("A friend asked you to check in today"). No member ID, no nickname, no health words. |
| EAS Build (Expo) | App source code at build time | Source contains no secrets and no user data. `.env` is not uploaded (`.easignore`). |
| Google Play Services / Android OS | Standard OS-level data | `allowBackup=false` turns off Android cloud backup of app data. |

## Threat model

### Assets

A1 recovery data on the phone (check-ins, slips, vault, tags) · A2 the fact
that the user is in recovery at all · A3 the support-circle graph (who supports
whom) · A4 coach conversations · A5 the integrity of the help-resources content.

### Adversaries

- **T-Close**: someone with physical access to the unlocked or locked phone
  (partner, family member, employer, dealer). This is the **most likely threat**.
- **T-Lost**: a lost or stolen phone.
- **T-Net**: an attacker on the same Wi-Fi.
- **T-Server**: someone who compromises the laptop server or its database.
- **T-Invite**: an attacker who guesses or intercepts invite codes, or a
  supporter who becomes untrusted.
- **T-Relay**: a third-party push relay that sees notification metadata.
- **T-Dev**: developer mistakes (logging personal data, hard-coding contacts,
  adding a tracking SDK).

### Threats and mitigations

| ID | Threat | Asset | Mitigation | Residual risk |
|---|---|---|---|---|
| TH1 | T-Close opens the app | A1, A2 | App lock (PIN/biometric). Locks on launch and after 1 minute in the background. PIN: 4–6 digits, weak PINs (repeats, runs, common PINs) refused, stored as a PBKDF2-SHA256 hash (5k rounds, random salt; plain JS is slow on phones, and the 15-failure cap, not the round count, is what limits guessing) in the secure store. Older records are re-saved on unlock. Wrong PINs: a growing wait after 5 tries, and PIN entry is switched off after 15 failures in total (then only biometrics or delete-all), because the wait uses the phone clock, which someone holding the phone can change. Biometrics: no passcode fallback, and unlock reads a token stored with `requireAuthentication`, which Android invalidates when a new fingerprint or face is enrolled (biometric unlock then turns itself off). Quick-hide button (and optional shake) switches to a neutral screen; leaving it always needs the PIN. | Shoulder-surfing while the app is open. The PIN is an app lock, not the database key: someone who can read the Keystore of an unlocked, rooted phone does not need it (see TH4). |
| TH2 | T-Close sees the app-switcher preview or takes a screenshot | A1 | `FLAG_SECURE` through `expo-screen-capture` on **every** screen, so previews are blank and screenshots are blocked. | Camera photo of the screen. |
| TH3 | T-Close reads lock-screen notifications | A2 | All notification text comes from a dedicated i18n namespace. A test bans terms such as drug, craving, relapse, slip, recovery and addiction there. Lock-screen visibility is set to "private". | The app's name and icon are visible. A neutral app name is future work. |
| TH4 | T-Lost extracts files from the device | A1 | SQLCipher DB with `secure_delete`. Key in the hardware-backed Keystore. Media kept as BLOBs inside the DB; the recorder's and picker's unencrypted copies are deleted right after use and swept at every launch. Voice playback stops on lock, hide and delete-all, and never runs in the background. `allowBackup=false`. Camera and broad storage permissions are blocked. | A rooted device with the app unlocked. A few seconds' window while a recording or picked photo exists unencrypted in the cache. |
| TH5 | T-Close forces the user to unlock | A1, A2 | Quick-hide. Delete-all is reachable in 2 taps from settings, and from the lock screen ("forgot PIN"). | Coercion cannot be fully prevented. Documented as a limitation. Because delete-all works from the lock screen without the PIN, someone holding the phone can wipe the data (they cannot read it). |
| TH5b | The quick-hide screen gives the app away | A2 | The neutral "Notes" screen shows nothing personal. | **Deliberate trade-off:** it keeps the "Get help" button, because safety rule 2 (help on every screen) comes first. Do not remove it "for discretion". |
| TH5c | The keyboard learns private words | A1, A2 | Every text field is `SafeTextInput`, which turns off autocorrect, spell-check, autofill and suggestions. | Some third-party keyboards ignore these hints. |
| TH6 | T-Net intercepts traffic to the laptop server | A3, A4 | Bearer-token auth. Demo runs on a private Wi-Fi. HTTPS through a local reverse proxy (Caddy, internal CA) is documented in `deploy.md`. Payloads hold no personal data. | Plain HTTP on a trusted home Wi-Fi in development. Documented. |
| TH7 | T-Server dumps the DB | A3 | Only random IDs, hashes and 7-day signals. No names or contacts. Token hashes, not tokens. | The link graph between random IDs is visible. |
| TH8 | T-Invite brute-forces invite codes | A3 | 10-character base32 codes (~50 bits), single use, 24 h expiry, stored hashed. Rate limit on redemption. The member must approve each new supporter. Max 3 supporters. | Social engineering. |
| TH9 | An untrusted supporter | A2 | The member can revoke at any time. Supporters get nothing beyond the neutral signal. | The supporter already knows the person is in recovery. |
| TH10 | Signal spam / abuse | A3 | Rate limit of 3 signals per day per member, plus per-IP limits on the API. | — |
| TH11 | The coach service logs or keeps chat text | A4 | Stateless design. Body logging is off and a test checks it. No DB in the coach container. Off by default. | Ollama or OS-level swap. Documented. |
| TH12 | The coach gives harmful advice | user safety | Crisis detection on the device and on the server. Topic guard. Output checker. Safety eval suite with 100% required on crisis, self-harm, overdose and dosing cases. | LLM unpredictability. The coach stays optional and clearly labelled as not a therapist. |
| TH13 | Help resources are wrong or out of date | A5 | `helplines.json` is edited only by the developer (hook-protected) and carries a "last verified" date. The app warns when an entry is unverified or over 6 months old. An entry is shown as red "emergency services" only if it has a name and a checked date. | Human error in verification. |
| TH14 | T-Dev adds tracking or logs personal data | A1 | No analytics SDKs. A dependency allow-list test in CI. A lint rule bans `console.log` in `app/src`. The privacy-reviewer subagent runs on storage, server and notification changes. | Review gaps. |
| TH15 | Delete-all is incomplete | A1, A3 | Delete-all deletes the DB key **first** (retried once), then closes and deletes the DB file, clears the secure store and the biometric token, stops voice playback, clears the media temp folders, cancels notifications, and (from M6) calls `DELETE /account` (cascades links and signals). Every step runs even if one fails. If the key could not be deleted, the user is told the data may still be readable; otherwise that the leftovers are unreadable. If the server cannot be reached, deletion is queued and the user is told. | The server account lingers if the user never comes back online. Signals still auto-expire after 7 days. |

### Out of scope (documented limitations)

- Compromised or rooted devices, and OS-level malware.
- iOS (not built in this project). On iOS the app-switcher snapshot would not be blanked.
- The web demo (`npx expo start`, press `w`) is unencrypted and in memory only, with a
  "not for real data" banner. It is never shipped; the Android bundle does not contain it.
- The SQLCipher encryption test runs against a test double of expo-sqlite. On a
  development build, check once by hand that `recovery.db` does not start with
  `SQLite format 3` (the app also refuses to start on a build without SQLCipher).
- Real-world clinical validation of the risk model.
- Legal and regulatory compliance for real deployment (not done; demo only).

## Privacy checks in the test suite

| Check | Milestone |
|---|---|
| DB file is unreadable without the key (opening with no key, a wrong key, or without SQLCipher fails) | 2 |
| PIN: salted slow hash, attempt limits, clock tampering, corrupt state | 2 |
| Crisis words (en/si/ta and romanised) open help from any text field | 2 |
| Delete-all removes DB, key, notifications and server account | 2, 6 |
| Only `src/net/*` may make network calls | 2 |
| No phone-number patterns in `app/src` (helplines come from content only) | 2 |
| Vault BLOB round trip and size limits; SOS sessions saved in the encrypted DB | 3 |
| Delete-all clears media temp folders | 3 |
| App permissions: no camera, microphone kept for voice notes, no background playback, storage blocked | 3 |
| Check-ins saved in the encrypted DB; one per day; invalid levels and unknown tags refused | 4 |
| Reminder text bans drug/craving/recovery terms in en/si/ta; channel lock-screen visibility is private | 4 |
| Demo data is marked and clearing never removes the user's own rows | 4 |
| Model parity (Python vs app within 1e-6); model trained on synthetic data only | 5 |
| Heads-up: off by default, ≤ 1 a day, quiet hours, neutral text in en/si/ta | 5 |
| Coping plan saved in the encrypted DB; crisis words in it open help | 5 |
| Notification strings contain no banned terms, in all 3 languages | 4, 5 |
| Server schema matches the column allow-list | 6 |
| Signals older than 7 days are purged | 6 |
| Coach service never logs request bodies | 9 |
| No analytics or ad packages in `package.json` | 11 (CI) |
