/** Normalise an Indian phone number to +91XXXXXXXXXX. Leaves other formats as +digits. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("{{")) return null; // unresolved dynamic variable
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

/** +91 98XXX XX412 — for alerts and logs where the full number isn't needed. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "Unknown";
  const d = phone.replace(/\D/g, "");
  if (d.length < 6) return phone;
  const last3 = d.slice(-3);
  const first2 = d.length >= 12 ? d.slice(2, 4) : d.slice(0, 2);
  return `+91 ${first2}XXX XX${last3}`;
}
