export interface BudgetStatus {
  /** Harcanan / bütçe (1 = %100) */
  ratio: number;
  /** Kalan tutar (aşıldıysa 0) */
  remaining: number;
  /** Aşılan tutar (aşılmadıysa 0) */
  over: number;
  level: 'ok' | 'warning' | 'over';
}

/** Aylık bütçeye göre durum: %80'den sonra uyarı, %100'ü geçince aşım. */
export function budgetStatus(spent: number, budget: number): BudgetStatus {
  const ratio = budget > 0 ? spent / budget : 0;
  return {
    ratio,
    remaining: Math.max(0, budget - spent),
    over: Math.max(0, spent - budget),
    level: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok',
  };
}
