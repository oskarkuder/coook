/** Weeks run Monday → Sunday. All keys are local-time "YYYY-MM-DD". */

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date = new Date()): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = copy.getDay(); // 0 = Sunday
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(copy, offset);
}

export function currentWeekStartKey(): string {
  return toDateKey(startOfWeek());
}

export function weekDateKeys(weekStartKey: string): string[] {
  const start = fromDateKey(weekStartKey);
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}

export function shiftWeek(weekStartKey: string, weeks: number): string {
  return toDateKey(addDays(fromDateKey(weekStartKey), weeks * 7));
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = fromDateKey(value);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDayName(dateKey: string): string {
  return DAY_NAMES[fromDateKey(dateKey).getDay()] ?? "";
}

export function formatDayNumber(dateKey: string): string {
  return String(fromDateKey(dateKey).getDate());
}

export function formatWeekRange(weekStartKey: string): string {
  const start = fromDateKey(weekStartKey);
  const end = addDays(start, 6);
  const startLabel = `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`;
  const endLabel =
    start.getMonth() === end.getMonth()
      ? String(end.getDate())
      : `${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;
  return `${startLabel} – ${endLabel}`;
}

export function isToday(dateKey: string): boolean {
  return dateKey === toDateKey(new Date());
}

// ---------------------------------------------------------------------------
// Months — for the calendar on the plan page. Keys are "YYYY-MM".
// ---------------------------------------------------------------------------

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FULL_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function currentMonthKey(): string {
  return toDateKey(new Date()).slice(0, 7);
}

export function isValidMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function shiftMonth(monthKey: string, months: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  const date = new Date(year, month + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthYear(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  return `${FULL_MONTHS[month]} ${year}`;
}

/**
 * The days the calendar grid actually shows: whole weeks (Mon–Sun) covering the
 * month, so the grid is always rectangular and never jumps height between
 * months.
 */
export function monthGridDays(monthKey: string): string[] {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const start = startOfWeek(first);
  const endOfLastWeek = addDays(startOfWeek(last), 6);

  const days: string[] = [];
  for (let d = start; d <= endOfLastWeek; d = addDays(d, 1)) {
    days.push(toDateKey(d));
  }
  return days;
}

export function isSameMonth(dateKey: string, monthKey: string): boolean {
  return dateKey.startsWith(monthKey);
}

export function formatFullDay(dateKey: string): string {
  const date = fromDateKey(dateKey);
  const weekday = FULL_DAYS[date.getDay()];
  return `${weekday} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}
