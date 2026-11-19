export type BadgeKey = "new" | "limited";

export type AspectMeta = { key: string; label: string };

export type Aspects = Record<string, number | null>;
export type AspectNotes = Record<string, string | null>;

export type Benchmark = {
	name?: string;
	score?: number | string;
	metric?: string;
	harness?: string;
	version?: string;
	variant?: string;
	source?: string;
};

export type Usage = {
	rankLastWeek?: number | null;
	tokens?: number | null;
	sharePercent?: number | null;
	uniqueUsers?: number | null;
	sessions?: number | null;
	weeklyRetentionPercent?: number | null;
	costPerSessionUsd?: number | null;
	cachedInputPercent?: number | null;
};

export type ModelFacts = {
	contextTokens?: number | null;
	outputTokens?: number | null;
	inputModalities?: string[];
	outputModalities?: string[];
	reasoning?: boolean | null;
	toolCall?: boolean | null;
	openWeights?: boolean | null;
	releaseDate?: string | null;
};

export type SnapshotEntry = {
	path: string;
	name: string;
	updatedAt: string | null;
	aspects: Aspects;
	aspectNotes: AspectNotes;
	benchmarks: Benchmark[];
	facts: ModelFacts;
	usage: Usage;
};

export type Snapshot = {
	source: string;
	sourceUrl: string;
	fetchedAt: string;
	updatedAt: string | null;
	aspects: AspectMeta[];
	models: Record<string, SnapshotEntry>;
};

export type CatalogModel = {
	id: string;
	name?: string;
	canonical_id?: string;
	release_date?: string;
	cost?: {
		text?: {
			input?: { price?: number | string; cache?: { read?: number | string } };
			output?: { price?: number | string };
		};
	};
	go?: { monthly_usage?: Record<string, number> | null };
};

export type Row = {
	model: string;
	slug: string;
	badges: BadgeKey[];
	go_requests_5h: number | null;
	blended_price: number;
	price_input: number;
	price_output: number;
	price_cache: number;
	modelData: SnapshotEntry | null;
	score: number | null;
	request_score: number | null;
	value: number | null;
	scorePerDollar: number | null;
	[key: string]: unknown;
};

export type Column = {
	key: string;
	label: string;
	type: "text" | "bar-s" | "num";
	align: "left" | "right";
	digits?: number;
	description?: string;
};
