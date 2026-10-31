# API reference

[Handbook home](README.md) · Previous: [Backend guide](BACKEND_GUIDE.md) · Next: [Database guide](DATABASE_GUIDE.md)

Two HTTP APIs exist:

- [Support-circle API](#support-circle-api) (`server/`, port 8000): 12 endpoints
- [Coach API](#coach-api) (`coach/`, port 8001): 2 endpoints

All examples use made-up values. `<token>` stands for a bearer token, which you get
from `POST /accounts`. Never paste a real token into documents or issues.

## Support-circle API

Base URL on a laptop: `http://localhost:8000`. Source: `server/app/routes/`.

### Conventions

- **Auth:** `Authorization: Bearer <token>` on every endpoint except `/health` and
  `POST /accounts`.
- **Request bodies** are JSON and **forbid unknown fields** (`schemas.Strict`).
- **Times** are Unix epoch seconds (integers).
- **Errors** are short codes the app translates: `{"detail": "circle_full"}`. The one
  exception is FastAPI's built-in body validation error (see [Errors](#errors)).

### Endpoint list

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness check |
| POST | `/accounts` | none | Create a member or supporter account |
| DELETE | `/account` | any | Delete this account and everything linked to it |
| PUT | `/account/push-token` | supporter | Register an Expo push token |
| DELETE | `/account/push-token` | any | Remove the push token |
| POST | `/invites` | member | Create a 24-hour invite code |
| POST | `/invites/redeem` | supporter | Join with a code (link becomes pending) |
| GET | `/links` | any | List this account's links |
| POST | `/links/{link_id}/approve` | member | Approve a pending link |
| DELETE | `/links/{link_id}` | any (own link) | End a link |
| POST | `/signals` | member | Send "please check in on me" |
| GET | `/signals` | supporter | Recent requests from linked members |

### GET /health

```http
GET /health
```

```json
200 OK
{"status": "ok"}
```

### POST /accounts

Creates an account when a person turns the circle (or supporter mode) on. No name,
email or phone number.

```http
POST /accounts
Content-Type: application/json

{"role": "member"}
```

```json
201 Created
{
  "account_id": "6f1c2b9e-0000-4000-8000-000000000001",
  "token": "<token, shown only once>",
  "role": "member"
}
```

Errors: `422` (bad role or extra field), `429 too_many_tries` (more than 10 accounts
an hour from one address).

### DELETE /account

Deletes the account. Invites, links, signals and push token go with it (cascade).

```http
DELETE /account
Authorization: Bearer <token>
```

`204 No Content`. Errors: `401 unauthorized`.

### PUT /account/push-token

Supporters only, after they turn on notifications in the app.

```http
PUT /account/push-token
Authorization: Bearer <token>
Content-Type: application/json

{"token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "lang": "en"}
```

`204 No Content`. The token must match `ExpoPushToken[...]` or
`ExponentPushToken[...]` (max 200 characters); `lang` is `en`, `si` or `ta` (the
language of the fixed push text). Errors: `401`, `403 wrong_role`, `422`.

### DELETE /account/push-token

`204 No Content`. Errors: `401`.

### POST /invites

Creates the member's single open invite code. A new code replaces the old one.

```http
POST /invites
Authorization: Bearer <token>
```

```json
201 Created
{"code": "ABCD2EFGH3", "expires_at": 1800086400}
```

Errors: `401`, `403 wrong_role`, `409 circle_full` (3 supporters already, pending
or active), `429 too_many_tries` (more than 10 an hour).

### POST /invites/redeem

A supporter joins with a code. Spaces and dashes are allowed while typing.

```http
POST /invites/redeem
Authorization: Bearer <token>
Content-Type: application/json

{"code": "ABCD2 EFGH3"}
```

```json
201 Created
{"link_id": "9a7e4c1d-0000-4000-8000-000000000002", "status": "pending"}
```

Errors:

| Status | Detail | When |
|---|---|---|
| 401 | `unauthorized` | Bad or missing token |
| 403 | `wrong_role` | Caller is a member |
| 404 | `not_found` | Unknown, used **or** expired code (always the same answer) |
| 409 | `circle_full` | The member already has 3 supporters |
| 409 | `already_linked` | This supporter is already linked to this member |
| 422 | `invalid_code` | Not 10 characters after cleaning (or fails the body pattern) |
| 429 | `too_many_tries` | 5 wrong codes per account or 20 per address in an hour; then even a right code is refused |

### GET /links

```http
GET /links
Authorization: Bearer <token>
```

```json
200 OK
[
  {"id": "9a7e4c1d-0000-4000-8000-000000000002", "status": "pending", "created_at": 1800000000}
]
```

Members see links where they are the member; supporters see links where they are the
supporter. **Account IDs are never returned**: each side knows a link only by its ID.

### POST /links/{link_id}/approve

```http
POST /links/9a7e4c1d-0000-4000-8000-000000000002/approve
Authorization: Bearer <token>
```

```json
200 OK
{"id": "9a7e4c1d-0000-4000-8000-000000000002", "status": "active", "created_at": 1800000600}
```

`created_at` is reset to the approval time, so requests sent while the link was
pending stay hidden from the new supporter. Errors: `401`, `404 not_found` (not
your link), `403 wrong_role` (caller is the supporter).

### DELETE /links/{link_id}

Either side can end a link at any time, with no notice to the other.
`204 No Content`. Errors: `401`, `404 not_found`.

### POST /signals

"Please check in on me". The body **must be empty**.

```http
POST /signals
Authorization: Bearer <token>
```

```json
201 Created
{"created_at": 1800003600, "remaining_today": 2}
```

Errors: `401`, `403 wrong_role`, `409 no_supporters` (no approved supporter),
`422 no_content_allowed` (a body was sent), `429 daily_limit` (3 in 24 hours).

If push is enabled, each active supporter with a push token gets the fixed neutral
text after the response is sent.

### GET /signals

```http
GET /signals
Authorization: Bearer <token>
```

```json
200 OK
[
  {"link_id": "9a7e4c1d-0000-4000-8000-000000000002", "created_at": 1800003600}
]
```

Only active links, only signals sent after approval and within 7 days, newest
first, at most 50. Errors: `401`, `403 wrong_role`.

### Errors

| Status | Meaning |
|---|---|
| 401 `unauthorized` | Missing, malformed or unknown token (with `WWW-Authenticate: Bearer`) |
| 403 `wrong_role` | The endpoint is for the other role |
| 404 `not_found` | Not found, or not yours (the API does not say which) |
| 409 | A rule blocks it: `circle_full`, `already_linked`, `no_supporters` |
| 422 | Invalid input. Route checks return a code (`invalid_code`, `no_content_allowed`). Body validation by FastAPI returns its standard list format: `{"detail": [{"type": ..., "loc": [...], "msg": ...}]}` |
| 429 | Rate limit: `too_many_tries` or `daily_limit` |

The app maps these codes to translated messages in `app/src/net/circleClient.ts`.

### Try it with curl

```bash
TOKEN=$(curl -s -X POST localhost:8000/accounts \
  -H 'Content-Type: application/json' -d '{"role":"member"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s -X POST localhost:8000/invites -H "Authorization: Bearer $TOKEN"
curl -s localhost:8000/links -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE localhost:8000/account -H "Authorization: Bearer $TOKEN" -o /dev/null -w '%{http_code}\n'
```

## Coach API

Base URL on a laptop: `http://127.0.0.1:8001`. Source: `coach/app/main.py`. No auth:
by default it listens on this computer only. **Not meant for public hosting.**

### GET /health

`200 OK` `{"status": "ok"}`

### POST /coach

```http
POST /coach
Content-Type: application/json

{
  "lang": "en",
  "message": "I had a long day and the craving is loud tonight",
  "history": [
    {"role": "user", "text": "hi"},
    {"role": "coach", "text": "Hi, I'm glad you reached out. How are you feeling?"}
  ]
}
```

Request rules: `lang` is `en`, `si` or `ta`; `message` and each turn's `text` are 1–500
characters; `history` has at most 6 turns; no extra fields.

Response: a `kind` tells the app what to show.

| `kind` | `text` | What the app shows |
|---|---|---|
| `reply` | The checked model reply | The reply; with `"note": "reach_out"` it adds a gentle note to reach out to people too |
| `crisis` | null | Its own crisis text and help buttons |
| `refusal` | null | Its own kind refusal for `topic` (`dosing`, `withdrawal`, `medical`, `drug_use`, `rules`), pointing to a professional |
| `fallback` | null | "I'm not able to answer that well", with other options |

```json
200 OK
{"kind": "reply", "topic": null, "text": "That sounds like a heavy day...", "note": null}
```

```json
200 OK
{"kind": "refusal", "topic": "dosing", "text": null, "note": null}
```

Errors (all short codes; the request text is never echoed back):

| Status | Detail | When |
|---|---|---|
| 411 | `invalid` | POST without a numeric `Content-Length` |
| 413 | `too_large` | Body over 16,384 bytes |
| 422 | `invalid` | Body fails validation |
| 429 | `too_many_tries` | More than 30 requests a minute from one address |
| 503 | `unavailable` | Ollama cannot be reached or gave no usable answer |
| 500 | `server` | Unexpected error (only the error type is logged) |

## Related pages

- [Backend guide](BACKEND_GUIDE.md): how the server code is organised
- [AI and ML](AI_AND_ML.md): what happens inside `POST /coach`
