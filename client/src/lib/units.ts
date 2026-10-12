/** Dinh dang / doc so do nguoi dung nhap (luon la cm / kg) - pure function. */

const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** 170.25 -> "170,3"; 160 -> "160" (dau phay thap phan, toi da 1 chu so le). */
export const formatNumber = (v: number) => NUMBER_FORMAT.format(v);

/**
 * Doc so nguoi dung go: chap nhan ca "170,5" lan "170.5" (so do < 1000 nen khong co
 * dau phan cach hang nghin). Khong phai so -> NaN.
 */
export function parseLocaleNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(s)) return NaN;
  return Number(s);
}
