/**
 * Web demo stand-in: browsers get no push. Supporter mode shows a clearly
 * labelled "Check for requests" button instead.
 */
export async function getPushToken(_channelName: string): Promise<string | null> {
  return null;
}

export async function forgetPushToken(): Promise<void> {}
