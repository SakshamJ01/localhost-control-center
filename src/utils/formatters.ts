export function formatElapsedTime(isoStartTime: string, isoEndTime?: string | null): string {
  const start = new Date(isoStartTime).getTime();
  const end = isoEndTime ? new Date(isoEndTime).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));

  if (diffSec < 60) {
    return `${diffSec}s`;
  }
  const min = Math.floor(diffSec / 60);
  const sec = diffSec % 60;
  if (min < 60) {
    return `${min}m ${sec}s`;
  }
  const hours = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hours}h ${remainMin}m`;
}

export function truncatePath(fullPath: string, maxLength = 45): string {
  if (fullPath.length <= maxLength) return fullPath;
  const parts = fullPath.split(/[\\/]/);
  if (parts.length <= 3) return fullPath;
  const first = parts[0];
  const last = parts.slice(-2).join('/');
  return `${first}/.../${last}`;
}

export function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const parsed = new URL(stringUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
