export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatMoney(value: number | string | null | undefined) {
  if (value == null) return '-';
  return Number(value).toFixed(2);
}

export function parseDisplayDateToBackend(dateStr: string, endOfDay = false) {
  if (!dateStr) return undefined;
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  return endOfDay ? `${yyyy}-${mm}-${dd}T23:59:59` : `${yyyy}-${mm}-${dd}T00:00:00`;
}

export function isValidDisplayDate(dateStr: string) {
  if (!dateStr) return true;
  return /^(\d{2})\.(\d{2})\.(\d{4})$/.test(dateStr);
}

export function autoFormatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function dateTextToHtmlDate(dateStr: string) {
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return '';
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export function htmlDateToDisplayDate(value: string) {
  if (!value) return '';
  const [yyyy, mm, dd] = value.split('-');
  return `${dd}.${mm}.${yyyy}`;
}

export function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function round2(value: number | string | null | undefined) {
  return Number(Number(value || 0).toFixed(2));
}
