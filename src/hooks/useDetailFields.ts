import { useEffect, useState } from 'react';

import { hasDetailColumns } from '../services/supabase/schema';

/** Fiş no / vergi no / ödeme / not alanları gösterilsin mi? (005 kurulumu yapıldıysa) */
export function useDetailFields(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    hasDetailColumns()
      .then((v) => alive && setEnabled(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}
