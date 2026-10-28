# Network boundary

This folder is the **only** place in the app allowed to talk to the network
(`fetch`, WebSocket, XMLHttpRequest, …). `src/__tests__/networkBoundary.test.ts`
fails the build if any other file does, and it also blocks tracking and ad SDKs.

Planned clients (empty until their milestones):

- `circleClient.ts` (M6): sends only random IDs and "please check in" signals.
- `coachClient.ts` (M9): sends the current coach message, only when the user
  has turned the coach on.

Nothing else leaves the phone. See `docs/privacy.md`.
