"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import { sanitizeHtml } from "@/lib/sanitize";

interface MathContentProps {
  html: string;
  className?: string;
}

// Urutan penting: delimiter display ($$, \[ \]) diproses sebelum inline ($, \( \)).
const MATH_PATTERNS: { regex: RegExp; display: boolean }[] = [
  { regex: /\$\$([\s\S]+?)\$\$/g, display: true },
  { regex: /\\\[([\s\S]+?)\\\]/g, display: true },
  { regex: /\\\(([\s\S]+?)\\\)/g, display: false },
  { regex: /\$([^$\n]+?)\$/g, display: false },
];

function renderTex(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode: display,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return "";
  }
}

function hasDelimiter(text: string): boolean {
  return text.includes("$") || text.includes("\\(") || text.includes("\\[");
}

type Match = { start: number; end: number; tex: string; display: boolean };

function findMatches(text: string): Match[] {
  const matches: Match[] = [];
  for (const { regex, display } of MATH_PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      const overlaps = matches.some((x) => start < x.end && end > x.start);
      if (!overlaps) matches.push({ start, end, tex: m[1], display });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

// Bangun fragment berisi teks biasa + elemen KaTeX dari sebuah string.
function buildFragment(text: string, matches: Match[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      frag.appendChild(document.createTextNode(text.slice(cursor, match.start)));
    }
    const rendered = renderTex(match.tex, match.display);
    if (rendered) {
      const span = document.createElement("span");
      span.className = match.display ? "katex-display-wrap" : "katex-inline-wrap";
      span.innerHTML = rendered;
      frag.appendChild(span);
    } else {
      frag.appendChild(document.createTextNode(text.slice(match.start, match.end)));
    }
    cursor = match.end;
  }
  if (cursor < text.length) {
    frag.appendChild(document.createTextNode(text.slice(cursor)));
  }
  return frag;
}

const SKIP_TAGS = new Set(["CODE", "PRE", "SCRIPT", "STYLE"]);

// Elemen inline yang boleh "diratakan" saat delimiter LaTeX terpecah antar tag.
const INLINE_TAGS = new Set([
  "SPAN", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "SUB", "SUP", "FONT", "A",
]);

function shouldSkip(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName) || el.classList.contains("katex")) return true;
  let parent = el.parentElement;
  while (parent) {
    if (parent.classList.contains("katex")) return true;
    parent = parent.parentElement;
  }
  return false;
}

// Cek apakah elemen hanya berisi teks & tag inline sederhana (aman untuk di-flatten).
function isSimpleInlineContainer(el: Element): boolean {
  for (const child of Array.from(el.children)) {
    if (!INLINE_TAGS.has(child.tagName)) return false;
    if (!isSimpleInlineContainer(child)) return false;
  }
  return true;
}

// Proses sebuah elemen: jika teks gabungannya mengandung delimiter yang terpecah
// antar tag inline, ratakan jadi teks lalu render. Selain itu, proses per node.
function processElement(el: Element) {
  if (shouldSkip(el)) return;

  const combined = el.textContent ?? "";
  const combinedMatches = hasDelimiter(combined) ? findMatches(combined) : [];

  // Kasus delimiter terpecah antar tag inline (mis. hasil paste MathType/Word):
  // teks gabungan punya rumus, tapi tidak ada satu text node pun yang memuat
  // pasangan delimiter lengkap. Ratakan elemen jadi teks lalu render.
  if (
    combinedMatches.length > 0 &&
    el.children.length > 0 &&
    isSimpleInlineContainer(el) &&
    !hasCompleteMatchInDirectText(el)
  ) {
    el.textContent = "";
    el.appendChild(buildFragment(combined, combinedMatches));
    return;
  }

  // Selain itu, proses per node (delimiter berada dalam satu text node).
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? "";
      if (hasDelimiter(text)) {
        const matches = findMatches(text);
        if (matches.length > 0) {
          (node as Text).replaceWith(buildFragment(text, matches));
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      processElement(node as Element);
    }
  }
}

// True jika ada satu text node langsung yang memuat pasangan delimiter lengkap.
function hasCompleteMatchInDirectText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? "";
      if (hasDelimiter(text) && findMatches(text).length > 0) return true;
    }
  }
  return false;
}

export default function MathContent({ html, className }: MathContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeHtml(html);
    processElement(el);
  }, [html]);

  return <div ref={ref} className={className ? `rich-content ${className}` : "rich-content"} />;
}
