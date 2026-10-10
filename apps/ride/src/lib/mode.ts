import AsyncStorage from '@react-native-async-storage/async-storage';

/** The two halves of the app: taking a ride, or driving as a captain. */
export type AppMode = 'rider' | 'captain';

const LAST_MODE_KEY = 'nouzl.ride.lastMode';

/** First screen of each mode; the app reopens on the mode used last. */
export const MODE_HOME = {
  rider: '/ride',
  captain: '/drive',
} as const;

/** Last used mode on this device. Rider on first launch or if storage fails (spec 0001, Mode switch). */
export async function getLastMode(): Promise<AppMode> {
  const stored = await AsyncStorage.getItem(LAST_MODE_KEY).catch(() => null);
  return stored === 'captain' ? 'captain' : 'rider';
}

export async function setLastMode(mode: AppMode): Promise<void> {
  await AsyncStorage.setItem(LAST_MODE_KEY, mode).catch(() => undefined);
}
