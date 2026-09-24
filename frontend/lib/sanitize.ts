import DOMPurify, { type DOMPurify as DOMPurifyInstance } from "dompurify";

// Konten soal/pembahasan ditulis guru & admin lalu dirender ke siswa dan admin.
// Token login ada di localStorage, jadi HTML ini WAJIB disanitasi dengan
// allowlist (bukan denylist): tag, atribut, skema URL, dan properti CSS.

const ALLOWED_TAGS = [
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "div", "span", "strong", "b", "em", "i", "u", "s", "strike",
  "ol", "ul", "li", "blockquote", "pre", "code", "sub", "sup",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
  "a", "img", "math", "mi", "mo", "mn", "msup", "msub", "mfrac",
  "mrow", "msqrt", "munderover", "munder", "mover", "mtext", "mspace", "mtable",
];

// Atribut non-URL. DOMPurify mencocokkan nilai atribut di luar daftar
// URI-safe dengan ALLOWED_URI_REGEXP, sehingga colspan="2" dkk. ikut terhapus
// kalau tidak didaftarkan sebagai URI-safe.
const PLAIN_ATTR = [
  "colspan", "rowspan", "width", "height", "align", "valign", "border",
  "start", "dir", "lang", "mathvariant", "display",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "style", ...PLAIN_ATTR];

// https, path absolut (/uploads/...), anchor, mailto, dan gambar raster data URI.
// http:// ditolak karena halaman HTTPS tidak boleh memuat resource HTTP.
const ALLOWED_URI_REGEXP = /^(?:https:|mailto:|\/|#|data:image\/(?:png|jpe?g|gif|webp);)/i;

const ALLOWED_STYLE_PROPS = new Set([
  "text-align", "vertical-align", "color", "background-color",
  "font-weight", "font-style", "font-size", "text-decoration", "text-decoration-line",
  "width", "height", "max-width", "min-width", "max-height",
  "border", "border-width", "border-style", "border-color", "border-collapse",
  "border-top", "border-right", "border-bottom", "border-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-left", "margin-right", "list-style-type", "white-space",
]);

let purifier: DOMPurifyInstance | null = null;

function getPurifier(): DOMPurifyInstance {
  if (purifier) return purifier;
  purifier = DOMPurify(window);
  purifier.addHook("afterSanitizeAttributes", (node) => {
    const el = node as Element;
    const src = el.getAttribute?.("src");
    // DOMPurify mengizinkan data: URI pada <img> di luar ALLOWED_URI_REGEXP;
    // SVG tetap ditolak.
    if (src && /^\s*data:/i.test(src) && !ALLOWED_URI_REGEXP.test(src.trim())) {
      el.removeAttribute("src");
    }
    const style = el.getAttribute?.("style");
    if (style != null) {
      // Buang properti di luar allowlist (mis. position:fixed untuk overlay
      // phishing) dan nilai yang memuat url()/expression()/escape CSS.
      // Dibaca dari teks deklarasi asli agar shorthand tidak melebar jadi longhand.
      const kept = style
        .split(";")
        .map((decl) => {
          const idx = decl.indexOf(":");
          if (idx < 0) return null;
          const prop = decl.slice(0, idx).trim().toLowerCase();
          const value = decl.slice(idx + 1).trim();
          if (!ALLOWED_STYLE_PROPS.has(prop) || !value || /url\s*\(|expression\s*\(|\\/i.test(value)) return null;
          return `${prop}: ${value}`;
        })
        .filter((decl): decl is string => decl !== null);
      if (kept.length) el.setAttribute("style", kept.join("; "));
      else el.removeAttribute("style");
    }
  });
  return purifier;
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  // Tanpa DOM (SSR) tidak bisa disanitasi dengan aman: jangan kembalikan HTML mentah.
  if (typeof window === "undefined") return "";
  return getPurifier().sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_URI_SAFE_ATTR: PLAIN_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}
