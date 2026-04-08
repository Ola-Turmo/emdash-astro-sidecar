import type { ExtractedDesign } from '../types.js';
export interface ThemeOutput {
    tokens: {
        colors: string;
        typography: string;
        spacing: string;
        borders: string;
        shadows: string;
    };
    components: string;
    layouts: {
        base: string;
        article: string;
    };
    tailwind: string;
    manifest: {
        name: string;
        sourceUrl: string;
        generatedAt: string;
        version: string;
    };
}
/**
 * Write theme tokens to output directory
 */
export declare function writeThemeTokens(outputDir: string, design: ExtractedDesign): Promise<void>;
/**
 * Write component styles to output directory
 */
export declare function writeComponentTemplates(outputDir: string, design: ExtractedDesign): Promise<void>;
/**
 * Generate Tailwind config override
 */
export declare function generateTailwindConfig(design: ExtractedDesign): string;
/**
 * Write Tailwind config to output directory
 */
export declare function writeTailwindConfig(outputDir: string, design: ExtractedDesign): Promise<void>;
/**
 * Write theme manifest
 */
export declare function writeThemeManifest(outputDir: string, design: ExtractedDesign): Promise<void>;
/**
 * Build layout templates
 */
export declare function generateBaseLayout(): string;
export declare function generateArticleLayout(): string;
/**
 * Write layout files to output directory
 */
export declare function writeLayouts(outputDir: string): Promise<void>;
/**
 * Main theme generation function
 */
export declare function generateTheme(design: ExtractedDesign, outputDir: string): Promise<ThemeOutput>;
//# sourceMappingURL=output.d.ts.map