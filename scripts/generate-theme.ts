// Generates the checked-in Arcade Candy theme overrides for Noph UI.
// Run with: bun scripts/generate-theme.ts

import {
	Hct,
	MaterialDynamicColors,
	SchemeVibrant,
	SchemeNeutral,
	argbFromHex,
	hexFromArgb,
	type SpecVersion,
} from "@material/material-color-utilities";

const SOURCES = {
	violet: "#7C4DFF",
	pink: "#FF3D9A",
	mint: "#00D6A3",
};
const SPEC: SpecVersion = "2025";

const roles: Array<[string, keyof typeof MaterialDynamicColors]> = [
	["background", "background"],
	["error", "error"],
	["error-container", "errorContainer"],
	["inverse-on-surface", "inverseOnSurface"],
	["inverse-primary", "inversePrimary"],
	["inverse-surface", "inverseSurface"],
	["neutral-palette-key-color", "neutralPaletteKeyColor"],
	["neutral-variant-palette-key-color", "neutralVariantPaletteKeyColor"],
	["on-background", "onBackground"],
	["on-error", "onError"],
	["on-error-container", "onErrorContainer"],
	["on-primary", "onPrimary"],
	["on-primary-container", "onPrimaryContainer"],
	["on-primary-fixed", "onPrimaryFixed"],
	["on-primary-fixed-variant", "onPrimaryFixedVariant"],
	["on-secondary", "onSecondary"],
	["on-secondary-container", "onSecondaryContainer"],
	["on-secondary-fixed", "onSecondaryFixed"],
	["on-secondary-fixed-variant", "onSecondaryFixedVariant"],
	["on-surface", "onSurface"],
	["on-surface-variant", "onSurfaceVariant"],
	["on-tertiary", "onTertiary"],
	["on-tertiary-container", "onTertiaryContainer"],
	["on-tertiary-fixed", "onTertiaryFixed"],
	["on-tertiary-fixed-variant", "onTertiaryFixedVariant"],
	["outline", "outline"],
	["outline-variant", "outlineVariant"],
	["primary", "primary"],
	["primary-container", "primaryContainer"],
	["primary-fixed", "primaryFixed"],
	["primary-fixed-dim", "primaryFixedDim"],
	["primary-palette-key-color", "primaryPaletteKeyColor"],
	["scrim", "scrim"],
	["secondary", "secondary"],
	["secondary-container", "secondaryContainer"],
	["secondary-fixed", "secondaryFixed"],
	["secondary-fixed-dim", "secondaryFixedDim"],
	["secondary-palette-key-color", "secondaryPaletteKeyColor"],
	["shadow", "shadow"],
	["surface", "surface"],
	["surface-bright", "surfaceBright"],
	["surface-container", "surfaceContainer"],
	["surface-container-high", "surfaceContainerHigh"],
	["surface-container-highest", "surfaceContainerHighest"],
	["surface-container-low", "surfaceContainerLow"],
	["surface-container-lowest", "surfaceContainerLowest"],
	["surface-dim", "surfaceDim"],
	["surface-tint", "surfaceTint"],
	["surface-variant", "surfaceVariant"],
	["tertiary", "tertiary"],
	["tertiary-container", "tertiaryContainer"],
	["tertiary-fixed", "tertiaryFixed"],
	["tertiary-fixed-dim", "tertiaryFixedDim"],
	["tertiary-palette-key-color", "tertiaryPaletteKeyColor"],
];

const neutralSource = Hct.fromInt(argbFromHex(SOURCES.violet));
const schemes = {
	...Object.fromEntries(
		Object.entries(SOURCES).map(([name, hex]) => {
			const source = Hct.fromInt(argbFromHex(hex));
			return [name, { light: new SchemeVibrant(source, false, 0, SPEC), dark: new SchemeVibrant(source, true, 0, SPEC) }];
		}),
	),
	neutral: {
		light: new SchemeNeutral(neutralSource, false, 0, SPEC),
		dark: new SchemeNeutral(neutralSource, true, 0, SPEC),
	},
} as Record<string, { light: SchemeVibrant | SchemeNeutral; dark: SchemeVibrant | SchemeNeutral }>;

function schemeFor(token: string): string {
	if (/^(on-)?primary/.test(token) || token === "inverse-primary") return "violet";
	if (/^(on-)?secondary/.test(token)) return "pink";
	if (/^(on-)?tertiary/.test(token)) return "mint";
	if (/^(on-(surface|background)|surface|background|outline|inverse|scrim|shadow|neutral)/.test(token)) return "neutral";
	return "violet";
}

function color(role: keyof typeof MaterialDynamicColors, dark: boolean, token: string): string {
	const dynamic = MaterialDynamicColors[role] as { getArgb: (scheme: SchemeVibrant | SchemeNeutral) => number };
	const scheme = schemes[schemeFor(token)][dark ? "dark" : "light"];
	return hexFromArgb(dynamic.getArgb(scheme));
}

// True-neutral canvas: surfaces stay gray in both schemes so violet/pink
// are reserved for data and single accents.
const SURFACE_OVERRIDES: Record<string, { light: string; dark: string }> = {
	"surface": { light: "#fafafa", dark: "#0f0f10" },
	"background": { light: "#fafafa", dark: "#0f0f10" },
	"surface-bright": { light: "#fafafa", dark: "#1c1c1f" },
	"surface-dim": { light: "#dbdbde", dark: "#0f0f10" },
	"surface-container-lowest": { light: "#ffffff", dark: "#131316" },
	"surface-container-low": { light: "#f4f4f5", dark: "#17171a" },
	"surface-container": { light: "#efeff1", dark: "#1b1b1f" },
	"surface-container-high": { light: "#e9e9ec", dark: "#202025" },
	"surface-container-highest": { light: "#e1e1e6", dark: "#26262c" },
	"surface-variant": { light: "#e4e4e7", dark: "#232327" },
	"surface-tint": { light: "#5f5c66", dark: "#cac4cf" },
	"outline": { light: "#76767a", dark: "#8a8a90" },
	"outline-variant": { light: "#d4d4d8", dark: "#3f3f46" },
	"inverse-surface": { light: "#131316", dark: "#f4f4f5" },
	"inverse-on-surface": { light: "#f4f4f5", dark: "#3f3f46" },
	"scrim": { light: "#000000", dark: "#000000" },
	"shadow": { light: "#000000", dark: "#000000" },
};

const pairs = roles.map(([token, method]) => {
	const override = SURFACE_OVERRIDES[token];
	if (override) return { token, light: override.light, dark: override.dark };
	return {
		token,
		light: color(method, false, token),
		dark: color(method, true, token),
	};
});
const lightLines = pairs.map(({ token, light }) => `\t--np-color-${token}: ${light};`);
const darkLines = pairs.map(({ token, dark }) => `\t--np-color-${token}: ${dark};`);

const output = [
	"/* Generated by scripts/generate-theme.ts — Arcade Candy (violet / pink / mint). */",
	":root {",
	...lightLines,
	"}",
	"@media (prefers-color-scheme: dark) {",
	"\t:root {",
	...darkLines.map((line) => `\t${line}`),
	"\t}",
	"}",
	":root[data-theme='light'] {",
	...lightLines,
	"}",
	":root[data-theme='dark'] {",
	...darkLines,
	"}",
	"",
].join("\n");

await Bun.write(new URL("../src/theme.css", import.meta.url), output);
console.log(`Wrote src/theme.css · ${roles.length} color roles from violet/pink/mint`);
