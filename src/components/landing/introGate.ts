export const INTRO_SEEN_KEY = 'deepsea_intro_seen';

/** The loading counter plays once per browser session, and never under reduced motion. */
export function shouldShowIntro(storage: Pick<Storage, 'getItem'>, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  try {
    return storage.getItem(INTRO_SEEN_KEY) !== '1';
  } catch {
    return false;
  }
}
