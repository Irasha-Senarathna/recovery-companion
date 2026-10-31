import { createContext, useContext } from 'react';
import { coachBaseUrl, createCoachClient, type CoachClient } from '../../net/coachClient';

/** The real client, or null when this build has no coach address (EXPO_PUBLIC_COACH_API_URL). */
export function defaultCoachClient(): CoachClient | null {
  const baseUrl = coachBaseUrl();
  return baseUrl ? createCoachClient({ baseUrl }) : null;
}

/** Screens get the client from here, so tests can swap in a fake service. */
export const CoachClientContext = createContext<CoachClient | null>(defaultCoachClient());

export function useCoachClient(): CoachClient | null {
  return useContext(CoachClientContext);
}
