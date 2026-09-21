const ALLOWED_TAGS = new Set([
  "P", "BR", "H1", "H2", "H3", "H4", "H5", "H6",
  "DIV", "SPAN", "STRONG", "B", "EM", "I", "U", "S", "STRIKE",
  "OL", "UL", "LI", "BLOCKQUOTE", "PRE", "CODE", "SUB", "SUP",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD",
  "A", "IMG", "MATH", "MI", "MO", "MN", "MSUP", "MSUB", "MFRAC",
  "MROW", "MSQRT", "MUNDEROVER", "MUNDER", "MOVER", "MTEXT", "MSPACE", "MTABLE",
]);

const UNSAFE_TAGS = new Set([
  "SCRIPT", "STYLE", "IFRAME", "FRAME", "FRAMESET", "OBJECT", "EMBED",
  "LINK", "META", "BASE", "FORM", "INPUT", "BUTTON", "TEMPLATE", "NOSCRIPT",
  "VIDEO", "AUDIO", "SOURCE", "TRACK", "MAP", "AREA", "SVG", "XMP",
]);

export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof window === "undefined") return dirty || "";

  const template = document.createElement("template");
  template.innerHTML = dirty;

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toUpperCase();
      if (UNSAFE_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        const isEventHandler = name.startsWith("on");
        const isUrlAttr = name === "href" || name === "src" || name === "xlink:href";
        const isJsUrl = isUrlAttr && value.startsWith("javascript:");
        const isDataUrlImg = name === "src" && value.startsWith("data:image/svg+xml");
        // Mixed content: halaman HTTPS tidak boleh memuat resource HTTP.
        const isInsecureUrl = isUrlAttr && value.startsWith("http://");
        if (isEventHandler || isJsUrl || isDataUrlImg || isInsecureUrl) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };

  walk(template.content as unknown as Element);
  return template.innerHTML;
}
