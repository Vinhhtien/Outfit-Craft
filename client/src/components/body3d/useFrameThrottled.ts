'use client';

// ===== NEW: Body 3D =====
import { useEffect, useState } from 'react';

/**
 * Cap nhat gia tri toi da 1 lan / frame: keo thanh truot ban ra hang chuc su kien moi giay,
 * chi gia tri cuoi cung trong moi frame duoc dung de dung lai hinh nguoi mau.
 */
export function useFrameThrottled<T>(value: T): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return v;
}
// ===== END NEW =====
