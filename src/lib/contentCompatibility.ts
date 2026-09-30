const RELEASE_ID_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;

export function needsContentUpgrade(minVersion: string | undefined, currentVersion: string): boolean {
  if (!minVersion || !RELEASE_ID_PATTERN.test(minVersion) || !RELEASE_ID_PATTERN.test(currentVersion)) return false;
  const required = minVersion.split(".").map(Number);
  const current = currentVersion.split(".").map(Number);
  for (let index = 0; index < required.length; index += 1) {
    if (required[index] !== current[index]) return required[index] > current[index];
  }
  return false;
}
