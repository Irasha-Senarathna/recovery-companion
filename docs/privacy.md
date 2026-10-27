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
| Daily check-ins (mood, sleep, stress, craving) | Check-in | High | No | Until deleted | Delete-all |
| Tags (places, people, situations) | Check-in, trigger map | High (may reveal location/people) | No | Until deleted | Delete-all |
| Craving SOS sessions (start, end, exercise, outcome) | Craving SOS | High | No | Until deleted | Delete-all |
| Reasons vault: text, photos, voice notes (BLOBs, size-limited) | Craving SOS | High | No | Until deleted | Per item / delete-all |
| Slips + gentle-question answers | Slips | Very high | No | Until deleted | Per item / delete-all |
| Goals, money saved, progress | Goals | Medium | No | Until deleted | Delete-all |
| Coping plan | Early warning | High | No | Until deleted | Delete-all |
| Risk scores, trigger patterns | Trigger map | High | No | Recomputed; only the latest 30 days kept | Delete-all |
| Supporter local labels (e.g. "Sister") | Support circle | Medium | **No.** The label exists only on the phone that set it | Until removed | Revoke / delete-all |
| Coach chat history | AI coach | Very high | Current turns are sent to the coach service when enabled | **Not stored by default.** Optional on-device history | Clear chat / delete-all |
| Scheduled local notifications | Early warning | Medium (lock screen) | No | Until fired/cancelled | Delete-all cancels them |

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
| TH1 | T-Close opens the app | A1, A2 | App lock (PIN/biometric). Re-locks after 1 minute in the background. Quick-hide button (and optional shake) switches to a neutral screen. | Shoulder-surfing while the app is open. |
| TH2 | T-Close sees the app-switcher preview or takes a screenshot | A1 | `FLAG_SECURE` through `expo-screen-capture` on sensitive screens, so previews are blank and screenshots are blocked. | Camera photo of the screen. |
| TH3 | T-Close reads lock-screen notifications | A2 | All notification text comes from a dedicated i18n namespace. A test bans terms such as drug, craving, relapse, slip, recovery and addiction there. Lock-screen visibility is set to "private". | The app's name and icon are visible. A neutral app name is future work. |
| TH4 | T-Lost extracts files from the device | A1 | SQLCipher DB. Key in the hardware-backed Keystore. Media kept as BLOBs inside the DB. `allowBackup=false`. | A rooted device with the app unlocked. |
| TH5 | T-Close forces the user to unlock | A1, A2 | Quick-hide. Delete-all is reachable in 2 taps from settings. | Coercion cannot be fully prevented. Documented as a limitation. |
| TH6 | T-Net intercepts traffic to the laptop server | A3, A4 | Bearer-token auth. Demo runs on a private Wi-Fi. HTTPS through a local reverse proxy (Caddy, internal CA) is documented in `deploy.md`. Payloads hold no personal data. | Plain HTTP on a trusted home Wi-Fi in development. Documented. |
| TH7 | T-Server dumps the DB | A3 | Only random IDs, hashes and 7-day signals. No names or contacts. Token hashes, not tokens. | The link graph between random IDs is visible. |
| TH8 | T-Invite brute-forces invite codes | A3 | 10-character base32 codes (~50 bits), single use, 24 h expiry, stored hashed. Rate limit on redemption. The member must approve each new supporter. Max 3 supporters. | Social engineering. |
| TH9 | An untrusted supporter | A2 | The member can revoke at any time. Supporters get nothing beyond the neutral signal. | The supporter already knows the person is in recovery. |
| TH10 | Signal spam / abuse | A3 | Rate limit of 3 signals per day per member, plus per-IP limits on the API. | — |
| TH11 | The coach service logs or keeps chat text | A4 | Stateless design. Body logging is off and a test checks it. No DB in the coach container. Off by default. | Ollama or OS-level swap. Documented. |
| TH12 | The coach gives harmful advice | user safety | Crisis detection on the device and on the server. Topic guard. Output checker. Safety eval suite with 100% required on crisis, self-harm, overdose and dosing cases. | LLM unpredictability. The coach stays optional and clearly labelled as not a therapist. |
| TH13 | Help resources are wrong or out of date | A5 | `helplines.json` is edited only by the developer (hook-protected) and carries a "last verified" date. The app shows a warning when an entry is over 6 months old. | Human error in verification. |
| TH14 | T-Dev adds tracking or logs personal data | A1 | No analytics SDKs. A dependency allow-list test in CI. A lint rule bans `console.log` in `app/src`. The privacy-reviewer subagent runs on storage, server and notification changes. | Review gaps. |
| TH15 | Delete-all is incomplete | A1, A3 | Delete-all removes the DB file, deletes the key, cancels notifications, calls `DELETE /account` (cascades links and signals) and clears the secure store. An integration test checks each step. If the server cannot be reached, deletion is queued and the user is told. | The server account lingers if the user never comes back online. Signals still auto-expire after 7 days. |

### Out of scope (documented limitations)

- Compromised or rooted devices, and OS-level malware.
- iOS (not built in this project).
- Real-world clinical validation of the risk model.
- Legal and regulatory compliance for real deployment (not done; demo only).

## Privacy checks in the test suite

| Check | Milestone |
|---|---|
| DB file is unreadable without the key (opening with no key fails) | 2 |
| Delete-all removes DB, key, notifications and server account | 2, 6 |
| Only `src/net/*` may make network calls | 2 |
| No phone-number patterns in `app/src` (helplines come from content only) | 2 |
| Notification strings contain no banned terms, in all 3 languages | 4, 5 |
| Server schema matches the column allow-list | 6 |
| Signals older than 7 days are purged | 6 |
| Coach service never logs request bodies | 9 |
| No analytics or ad packages in `package.json` | 11 (CI) |
