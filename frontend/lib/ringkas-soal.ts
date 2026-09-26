// Potongan pendek teks soal untuk tabel: N kata pertama, tanpa tag HTML.
// Rumus ($...$, \(...\), dll.) dihitung satu kata supaya tidak terpotong di tengah.
const TOKEN = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$|\S+/g;

export function ringkasSoal(html: string, maxKata = 10): { teks: string; terpotong: boolean } {
  const polos = (html || "")
    .replace(/<img\b[^>]*>/gi, " [gambar] ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  let akhir = 0;
  let jumlah = 0;
  const token = new RegExp(TOKEN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = token.exec(polos))) {
    if (jumlah === maxKata) return { teks: `${polos.slice(0, akhir)}…`, terpotong: true };
    akhir = match.index + match[0].length;
    jumlah += 1;
  }
  return { teks: polos, terpotong: false };
}
