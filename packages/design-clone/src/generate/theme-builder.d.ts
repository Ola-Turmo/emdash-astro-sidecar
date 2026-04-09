import type { ExtractedDesign } from '../types.js';
/**
 * Convert extracted colors to CSS custom properties
 */
export declare function convertColors(extracted: ExtractedDesign): string;
/**
 * Convert extracted typography to CSS
 */
export declare function convertTypography(extracted: ExtractedDesign): string;
/**
 * Convert extracted spacing to CSS
 */
export declare function convertSpacing(extracted: ExtractedDesign): string;
/**
 * Convert extracted borders to CSS
 */
export declare function convertBorders(extracted: ExtractedDesign): string;
/**
 * Convert extracted shadows to CSS
 */
export declare function convertShadows(extracted: ExtractedDesign): string;
/**
 * Generate component styles from extracted data
 */
export declare function convertComponents(extracted: ExtractedDesign): string;
//# sourceMappingURL=theme-builder.d.ts.map