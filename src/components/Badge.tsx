export type BadgeStatus = "good" | "warn" | "bad" | "info";

const LABELS: Record<BadgeStatus, string> = {
  good: "Good",
  warn: "Watch",
  bad: "Weak",
  info: "Context",
};

export default function Badge({ status, text }: { status: BadgeStatus; text?: string }) {
  return <span className={`badge badge-${status}`}>{text ?? LABELS[status]}</span>;
}
