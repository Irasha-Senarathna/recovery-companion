import { createContext, useContext } from 'react';
import { circleBaseUrl, createCircleClient, type CircleClient } from '../../net/circleClient';

/** The real client, or null when this build has no server address (EXPO_PUBLIC_CIRCLE_API_URL). */
export function defaultCircleClient(): CircleClient | null {
  const baseUrl = circleBaseUrl();
  return baseUrl ? createCircleClient({ baseUrl }) : null;
}

/** Screens get the client from here, so tests can swap in a fake server. */
export const CircleClientContext = createContext<CircleClient | null>(defaultCircleClient());

export function useCircleClient(): CircleClient | null {
  return useContext(CircleClientContext);
}
