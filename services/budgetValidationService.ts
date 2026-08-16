export type ExpenseRecord = {
  id: string;
  period: string;
  category: string;
  amount: number;
  collectedTons: number;
  notes?: string;
  createdAt?: unknown;
};

export type BudgetValidation = {
  periodCount: number;
  actualCostTotal: number;
  actualTonsTotal: number;
  weightedCostPerTon: number | null;
  validationMapePercent: number | null;
  validationMaePesos: number | null;
  status: 'waiting-for-records' | 'backtested' | 'needs-review';
  projectedBaseCost: number | null;
  projectedContingency: number | null;
  projectedTotalCost: number | null;
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function validateExpenseBudget(
  records: ExpenseRecord[],
  forecastTons: number,
  contingencyPercent: number,
): BudgetValidation {
  const periods = new Map<string, { amount: number; tons: number }>();
  records.forEach(record => {
    if (!/^\d{4}-\d{2}$/.test(record.period) || record.amount <= 0 || record.collectedTons <= 0) return;
    const current = periods.get(record.period) || { amount: 0, tons: 0 };
    current.amount += record.amount;
    // Multiple expense categories may repeat the same monthly collected tonnage.
    current.tons = Math.max(current.tons, record.collectedTons);
    periods.set(record.period, current);
  });

  const monthly = Array.from(periods.entries())
    .map(([period, value]) => ({ period, ...value, costPerTon: value.amount / value.tons }))
    .sort((a, b) => a.period.localeCompare(b.period));
  const actualCostTotal = monthly.reduce((sum, item) => sum + item.amount, 0);
  const actualTonsTotal = monthly.reduce((sum, item) => sum + item.tons, 0);
  const weightedCostPerTon = actualTonsTotal > 0 ? actualCostTotal / actualTonsTotal : null;

  const errors: number[] = [];
  const percentageErrors: number[] = [];
  monthly.forEach((item, index) => {
    if (index < 2) return;
    const history = monthly.slice(Math.max(0, index - 3), index);
    const predictedRate = history.reduce((sum, value) => sum + value.costPerTon, 0) / history.length;
    const predictedCost = predictedRate * item.tons;
    const error = Math.abs(item.amount - predictedCost);
    errors.push(error);
    percentageErrors.push(error / item.amount * 100);
  });

  const validationMapePercent = percentageErrors.length
    ? round(percentageErrors.reduce((sum, value) => sum + value, 0) / percentageErrors.length)
    : null;
  const validationMaePesos = errors.length
    ? round(errors.reduce((sum, value) => sum + value, 0) / errors.length)
    : null;
  const status = monthly.length < 3
    ? 'waiting-for-records'
    : validationMapePercent !== null && validationMapePercent <= 20
      ? 'backtested'
      : 'needs-review';
  const projectedBaseCost = weightedCostPerTon === null ? null : weightedCostPerTon * forecastTons;
  const projectedContingency = projectedBaseCost === null ? null : projectedBaseCost * Math.max(0, contingencyPercent) / 100;

  return {
    periodCount: monthly.length,
    actualCostTotal: round(actualCostTotal),
    actualTonsTotal: round(actualTonsTotal, 3),
    weightedCostPerTon: weightedCostPerTon === null ? null : round(weightedCostPerTon),
    validationMapePercent,
    validationMaePesos,
    status,
    projectedBaseCost: projectedBaseCost === null ? null : round(projectedBaseCost),
    projectedContingency: projectedContingency === null ? null : round(projectedContingency),
    projectedTotalCost: projectedBaseCost === null || projectedContingency === null ? null : round(projectedBaseCost + projectedContingency),
  };
}
