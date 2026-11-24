export function formatPlaybackTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);

  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
