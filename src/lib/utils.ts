export function getEffectiveUnitCost(unit: string, costPerUnit: number | string): number {
    const cost = Number(costPerUnit) || 0;
    const u = (unit || '').toLowerCase().trim();
    if (u === 'ml' || u === 'g') {
        return cost > 5 ? cost / 1000.0 : cost;
    }
    if (u === 'pcs' || u === 'cups' || u === 'slice' || u === 'pc' || u === 'pieces') {
        return cost > 10 ? cost / 100.0 : cost;
    }
    return cost;
}
