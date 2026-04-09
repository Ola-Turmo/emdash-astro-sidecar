import type { ExtractedDesign } from '../types.js';

/**
 * Convert extracted colors to CSS custom properties
 */
export function convertColors(extracted: ExtractedDesign): string {
  const cssLines: string[] = [':root {'];
  
  // Primary colors
  if (extracted.colors.primary.length > 0) {
    cssLines.push('  /* Primary */');
    extracted.colors.primary.slice(0, 5).forEach((color, i) => {
      const suffix = ['', '-100', '-200', '-300', '-400'][i] || `-${(i + 1) * 100}`;
      cssLines.push(`  --color-primary${suffix}: ${color};`);
    });
  }
  
  // Neutral colors
  if (extracted.colors.neutral.length > 0) {
    cssLines.push('  /* Neutral */');
    extracted.colors.neutral.slice(0, 5).forEach((color, i) => {
      const suffix = ['', '-100', '-200', '-300', '-400'][i] || `-${(i + 1) * 100}`;
      cssLines.push(`  --color-neutral${suffix}: ${color};`);
    });
  }
  
  // Semantic colors
  if (extracted.colors.semantic) {
    if (extracted.colors.semantic.success) cssLines.push(`  --color-success: ${extracted.colors.semantic.success};`);
    if (extracted.colors.semantic.warning) cssLines.push(`  --color-warning: ${extracted.colors.semantic.warning};`);
    if (extracted.colors.semantic.danger) cssLines.push(`  --color-danger: ${extracted.colors.semantic.danger};`);
    if (extracted.colors.semantic.info) cssLines.push(`  --color-info: ${extracted.colors.semantic.info};`);
  }
  
  cssLines.push('}');
  return cssLines.join('\n');
}

/**
 * Convert extracted typography to CSS
 */
export function convertTypography(extracted: ExtractedDesign): string {
  const lines: string[] = [':root {'];
  
  // Font families
  if (extracted.typography.fontFamilies.length > 0) {
    lines.push(`  --font-sans: ${extracted.typography.fontFamilies[0]};`);
  }
  
  // Font sizes (deduplicate and limit to common scale)
  const sizes = extracted.typography.fontSizes.slice(0, 10);
  const uniqueSizes = [...new Set(sizes.map(s => s.value))];
  uniqueSizes.slice(0, 6).forEach((size, i) => {
    const names = ['--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl', '--text-2xl'];
    lines.push(`  ${names[i]}: ${size};`);
  });
  
  lines.push('}');
  return lines.join('\n');
}

/**
 * Convert extracted spacing to CSS
 */
export function convertSpacing(extracted: ExtractedDesign): string {
  const lines: string[] = [':root {'];
  
  // Extract unique padding values
  const paddings = extracted.spacing.paddings.map(p => p.value);
  const uniquePaddings = [...new Set(paddings)].slice(0, 8);
  uniquePaddings.forEach((pad, i) => {
    lines.push(`  --space-${i + 1}: ${pad};`);
  });
  
  lines.push('}');
  return lines.join('\n');
}

/**
 * Convert extracted borders to CSS
 */
export function convertBorders(extracted: ExtractedDesign): string {
  const lines: string[] = [':root {'];
  
  const radii = extracted.borders.borderRadii.map(b => b.value);
  const uniqueRadii = [...new Set(radii)].slice(0, 6);
  const radiusNames = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl', '--radius-full'];
  uniqueRadii.forEach((radius, i) => {
    lines.push(`  ${radiusNames[i] || `--radius-${i}`}: ${radius};`);
  });
  
  lines.push('}');
  return lines.join('\n');
}

/**
 * Convert extracted shadows to CSS
 */
export function convertShadows(extracted: ExtractedDesign): string {
  const lines: string[] = [':root {'];
  
  const shadows = extracted.shadows.boxShadows.map(s => s.value);
  const uniqueShadows = [...new Set(shadows)].slice(0, 4);
  const shadowNames = ['--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl'];
  uniqueShadows.forEach((shadow, i) => {
    lines.push(`  ${shadowNames[i] || `--shadow-${i}`}: ${shadow};`);
  });
  
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate component styles from extracted data
 */
export function convertComponents(extracted: ExtractedDesign): string {
  const lines: string[] = [];
  
  // Button styles
  if (extracted.components.buttons.length > 0) {
    lines.push('/* Buttons */');
    extracted.components.buttons.slice(0, 3).forEach((btn, i) => {
      const variant = i === 0 ? '' : `-${i + 1}`;
      lines.push(`.btn${variant} {`);
      if (btn.backgroundColor) lines.push(`  background-color: ${btn.backgroundColor};`);
      if (btn.color) lines.push(`  color: ${btn.color};`);
      if (btn.borderRadius) lines.push(`  border-radius: ${btn.borderRadius};`);
      if (btn.padding) lines.push(`  padding: ${btn.padding};`);
      lines.push('}');
    });
  }
  
  // Card styles
  if (extracted.components.cards.length > 0) {
    lines.push('\n/* Cards */');
    extracted.components.cards.slice(0, 3).forEach((card, i) => {
      const variant = i === 0 ? '' : `-${i + 1}`;
      lines.push(`.card${variant} {`);
      if (card.backgroundColor) lines.push(`  background-color: ${card.backgroundColor};`);
      if (card.borderRadius) lines.push(`  border-radius: ${card.borderRadius};`);
      if (card.padding) lines.push(`  padding: ${card.padding};`);
      if (card.boxShadow) lines.push(`  box-shadow: ${card.boxShadow};`);
      lines.push('}');
    });
  }
  
  return lines.join('\n');
}
