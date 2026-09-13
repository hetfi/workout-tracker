/**
 * Input validation helpers.
 * Returns error message strings (for display) or null (valid).
 */

export function validateWeight(value: unknown): string | null {
  const n = Number(value);
  if (isNaN(n)) return "重量は数値で入力してください";
  if (n < 0) return "重量は0以上で入力してください";
  return null;
}

export function validateReps(value: unknown): string | null {
  const n = Number(value);
  if (isNaN(n)) return "回数は整数で入力してください";
  if (!Number.isInteger(n)) return "回数は整数で入力してください";
  if (n < 0) return "回数は0以上で入力してください";
  return null;
}

export function validateDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "日付は YYYY-MM-DD 形式で入力してください";
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return "無効な日付です";
  return null;
}

export function validateRestSeconds(value: unknown): string | null {
  const n = Number(value);
  if (isNaN(n) || !Number.isInteger(n)) {
    return "インターバルは整数秒で入力してください";
  }
  if (n < 0) return "インターバルは0以上で入力してください";
  return null;
}
