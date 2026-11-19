export function formatPerDollar(value: number | null | undefined): string {
	if (value == null) return "—";
	if (value === Infinity) return "Free";
	return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

export function formatNumber(value: number): string {
	if (value === Infinity) return "∞";
	if (Number.isInteger(value)) return String(value);
	return value.toFixed(2);
}

export function formatCompact(value: number | null | undefined): string {
	if (value == null) return "—";
	if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
	if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
	if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
	if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
	return String(value);
}

export function money(value: number | null | undefined): string {
	return `$${Number(value ?? 0).toFixed(2)}`;
}
