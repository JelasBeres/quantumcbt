// Format singkat waktu jadwal untuk siswa, mis. "Sen, 28 Sep 2026 08.00".
export function formatWaktuJadwal(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const tanggal = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${tanggal} ${jam}`;
}
