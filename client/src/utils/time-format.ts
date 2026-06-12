export function formatDurationFromMinutes(value: number | null | undefined) {
  const totalMinutes = Math.max(0, Math.round(value ?? 0));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days} d`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min`);

  return parts.join(' ');
}
