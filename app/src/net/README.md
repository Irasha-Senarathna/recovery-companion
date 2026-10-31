# Network boundary

This folder is the **only** place in the app allowed to talk to the network
(`fetch`, WebSocket, XMLHttpRequest, …). `src/__tests__/networkBoundary.test.ts`
fails the build if any other file does, and it also blocks tracking and ad SDKs.

Clients:

- `circleClient.ts` (M6): sends only a role, a bearer token, invite codes, link
  IDs, content-free "please check in" signals and (after opt-in) a push token.
  Server address: `EXPO_PUBLIC_CIRCLE_API_URL` in `app/.env`.
- `coachClient.ts` (M9): sends the current coach message, only when the user
  has turned the coach on.

Nothing else leaves the phone. See `docs/privacy.md`.
