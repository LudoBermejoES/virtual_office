const FILE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})-\d{4}\.db\.gz$/;

function parseDate(filename: string): Date | null {
  const m = FILE_PATTERN.exec(filename);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
}

function ym(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function filesToDelete(files: string[], now: Date): string[] {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);

  const parsed = files.flatMap((f) => {
    const d = parseDate(f);
    return d ? [{ name: f, date: d }] : [];
  });

  const old = parsed.filter((f) => f.date < cutoff);

  // Keep the last file of each month (max date per ym group)
  const lastPerMonth = new Map<string, Date>();
  for (const f of old) {
    const key = ym(f.date);
    const prev = lastPerMonth.get(key);
    if (!prev || f.date > prev) lastPerMonth.set(key, f.date);
  }

  return old
    .filter((f) => {
      const key = ym(f.date);
      const last = lastPerMonth.get(key)!;
      return f.date.getTime() !== last.getTime();
    })
    .map((f) => f.name);
}
