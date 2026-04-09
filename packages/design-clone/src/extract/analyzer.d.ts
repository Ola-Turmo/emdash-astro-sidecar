import type { ExtractedColors, ExtractedTypography, ExtractedSpacing, ExtractedBorders, ExtractedShadows, ExtractedComponents, ExtractedLayout, ExtractedDesign } from '../types.js';
/**
 * Fetch a URL and return its HTML content
 */
export declare function fetchPage(url: string): Promise<{
    html: string;
    finalUrl: string;
}>;
/**
 * Extract colors from HTML
 */
export declare function extractColors(html: string, baseUrl: string): ExtractedColors;
/**
 * Extract typography from HTML
 */
export declare function extractTypography(html: string): ExtractedTypography;
/**
 * Extract spacing from HTML
 */
export declare function extractSpacing(html: string): ExtractedSpacing;
/**
 * Extract border styles from HTML
 */
export declare function extractBorders(html: string): ExtractedBorders;
/**
 * Extract box shadows from HTML
 */
export declare function extractShadows(html: string): ExtractedShadows;
/**
 * Extract component styles from HTML
 */
export declare function extractComponents(html: string): ExtractedComponents;
/**
 * Extract layout rules from HTML
 */
export declare function extractLayout(html: string): ExtractedLayout;
/**
 * Analyze a URL and extract all design primitives
 */
export declare function analyzePage(url: string): Promise<ExtractedDesign>;
//# sourceMappingURL=analyzer.d.ts.map