import type { ExtractedDesign, ExtractedReport } from '../types.js';

/**
 * Convert extracted design to a JSON report
 */
export function generateReport(design: ExtractedDesign): ExtractedReport {
  const warnings: string[] = [];
  
  // Validate we got meaningful data
  if (design.colors.primary.length === 0) {
    warnings.push('No primary colors extracted - site may use images/gradients for colors');
  }
  
  if (design.typography.fontFamilies.length === 0) {
    warnings.push('No font families extracted - may be using system fonts');
  }
  
  if (design.components.buttons.length === 0) {
    warnings.push('No button elements detected - using default styles');
  }
  
  if (!design.layout.containerMaxWidth) {
    warnings.push('No container max-width found - assuming 1200px default');
  }
  
  return {
    design,
    warnings,
    metadata: {
      title: design.url,
    },
  };
}

/**
 * Print a human-readable summary of extracted design
 */
export function summarizeDesign(report: ExtractedReport): string {
  const { design, warnings } = report;
  
  const lines: string[] = [
    `=== Design Analysis for ${design.url} ===`,
    '',
    `Colors (${design.colors.primary.length} primary, ${design.colors.neutral.length} neutral)`,
    `  Primary: ${design.colors.primary.slice(0, 5).join(', ')}`,
    '',
    `Typography`,
    `  Fonts: ${design.typography.fontFamilies.join(', ')}`,
    `  Sizes found: ${design.typography.fontSizes.length}`,
    '',
    `Spacing values found: ${design.spacing.paddings.length} padding, ${design.spacing.margins.length} margin`,
    '',
    `Borders`,
    `  Radii: ${design.borders.borderRadii.slice(0, 5).map(b => b.value).join(', ')}`,
    '',
    `Shadows`,
    `  ${design.shadows.boxShadows.slice(0, 3).map(s => s.value).join('\n  ')}`,
    '',
    `Layout`,
    `  Container: ${design.layout.containerMaxWidth || 'not found (using default)'}`,
    `  Grid columns: ${design.layout.gridColumns || 'not detected'}`,
    '',
  ];
  
  if (warnings.length > 0) {
    lines.push('Warnings:');
    warnings.forEach(w => lines.push(`  ⚠ ${w}`));
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Export extracted design as JSON file content
 */
export function exportAsJson(report: ExtractedReport): string {
  return JSON.stringify(report, null, 2);
}