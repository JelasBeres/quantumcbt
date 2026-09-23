export const BAGIAN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Menunggu Review",
  revision_required: "Perlu Revisi",
  approved: "Disetujui"
};

export const BAGIAN_STATUS_TONE: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  draft: "neutral",
  pending_review: "warning",
  revision_required: "danger",
  approved: "success"
};

export function labelBagianStatus(status?: string | null): string {
  if (!status) return BAGIAN_STATUS_LABEL.draft;
  return BAGIAN_STATUS_LABEL[status] ?? status;
}

export function toneBagianStatus(status?: string | null): "neutral" | "warning" | "danger" | "success" {
  if (!status) return "neutral";
  return BAGIAN_STATUS_TONE[status] ?? "neutral";
}
