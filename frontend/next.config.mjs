/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
const base = backendUrl.replace(/\/+$/, "");

// FastAPI collection routes use a trailing slash. Resolve both browser forms
// here so FastAPI never redirects the browser to the private backend origin
// (which would drop its Authorization header).
const collections = [
  "grup-tryout", "guru-scope", "hasil-ujian", "jadwal-ujian", "jawaban-siswa",
  "kelas", "kategori-paket", "laporan-soal", "log-kecurangan", "login-activity", "opsi-jawaban",
  "paket-ujian", "pelajaran", "pemberitahuan", "pengaturan", "program", "siswa", "soal", "subbab", "topik",
  "ujian-siswa", "users", "paket-ujian/:paketId/bagian", "paket-ujian/:paketId/mapel"
];

const nextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      ...collections.flatMap((path) => ["", "/"].map((suffix) => ({
        source: `/api/${path}${suffix}`,
        destination: `${base}/${path}/`
      }))),
      {
        source: "/api/:path*",
        destination: `${base}/:path*`
      },
      {
        source: "/uploads/:path*",
        destination: `${base}/uploads/:path*`
      }
    ];
  }
};

export default nextConfig;
