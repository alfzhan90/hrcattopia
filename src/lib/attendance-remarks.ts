// Centralized remark/flag tags for attendance_logs.manager_notes.
// Multiple flags are joined with " | " so we can detect each independently.

export const REMARK = {
  DOUBLE_ENTRY: "⚠️ Potential Double Entry - Manual Check Required",
  AUTO_CHECKOUT: "🤖 System Auto-Checkout",
  FULL_TIME_ISSUE: "🚩 Forgot again/Attendance Issue",
  ID_MISSING: "ID Missing — device binding could not be confirmed",
  HISTORICAL_MISSING: "🚩 Historical: Missing/Invalid Logout",
  HISTORICAL_DOUBLE: "⚠️ Historical: Double Entry",
  FREQUENT_ISSUE: "🚩 Frequent Attendance Issue - Forgot again",
} as const;

export type RemarkKind =
  | "double_entry"
  | "auto_checkout"
  | "full_time_issue"
  | "id_missing"
  | "historical_missing"
  | "historical_double"
  | "frequent_issue"
  | "manual";

export function appendRemark(existing: string | null | undefined, tag: string): string {
  const base = (existing ?? "").trim();
  if (!base) return tag;
  if (base.includes(tag)) return base;
  return `${base} | ${tag}`;
}

export function classifyRemark(notes: string | null | undefined): RemarkKind[] {
  if (!notes) return [];
  const out: RemarkKind[] = [];
  // Order matters: check "Historical" variants BEFORE the generic ones so they aren't double-counted.
  if (notes.includes("Historical: Double Entry")) out.push("historical_double");
  else if (notes.includes(REMARK.DOUBLE_ENTRY)) out.push("double_entry");

  if (notes.includes("Historical: Missing/Invalid Logout")) out.push("historical_missing");

  if (notes.includes(REMARK.AUTO_CHECKOUT)) out.push("auto_checkout");
  if (notes.includes("Frequent Attendance Issue")) out.push("frequent_issue");
  if (notes.includes(REMARK.FULL_TIME_ISSUE)) out.push("full_time_issue");
  if (notes.includes(REMARK.ID_MISSING)) out.push("id_missing");
  if (out.length === 0) out.push("manual");
  return out;
}

export function isHabitualIncident(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return (
    notes.includes(REMARK.DOUBLE_ENTRY) ||
    notes.includes(REMARK.AUTO_CHECKOUT) ||
    notes.includes("Historical: Double Entry") ||
    notes.includes("Historical: Missing/Invalid Logout")
  );
}
