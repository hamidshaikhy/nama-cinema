const faNumber = new Intl.NumberFormat('fa-IR');
const faOneDecimal = new Intl.NumberFormat('fa-IR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const faDate = new Intl.DateTimeFormat('fa-IR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function fa(value: number): string {
  return faNumber.format(value);
}

export function faDecimal(value: number): string {
  return faOneDecimal.format(value);
}

/** Converts Latin digits inside a string, e.g. "18:45" -> "۱۸:۴۵". */
export function faDigits(text: string): string {
  return text.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function toman(value: number): string {
  return `${faNumber.format(value)} تومان`;
}

/** 500000 -> "۵۰۰" for compact legends that state the unit once. */
export function thousands(value: number): string {
  return faNumber.format(Math.round(value / 1000));
}

export function today(date = new Date()): string {
  return faDate.format(date);
}
