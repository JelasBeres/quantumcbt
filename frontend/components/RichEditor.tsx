"use client";

import dynamic from "next/dynamic";
import { sanitizeHtml } from "@/lib/sanitize";

const RichEditorCore = dynamic(() => import("./RichEditorCore"), { 
  ssr: false,
  loading: () => <div className="min-h-[160px] w-full animate-pulse rounded-input border border-card-border bg-neutral"></div>
});

export default RichEditorCore;
export { sanitizeHtml };
