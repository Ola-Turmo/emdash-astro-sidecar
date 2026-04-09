import {
  analyzePage,
  generateTheme,
  saveDraft,
  listDrafts,
  approveTheme,
  regenerateTheme,
} from '@emdash/design-clone';

export interface CloneResult {
  success: boolean;
  themeId?: string;
  url?: string;
  message: string;
  tokens?: {
    colors: number;
    typography: number;
    spacing: number;
    borders: number;
    shadows: number;
  };
  components?: string[];
  warnings?: string[];
}

export interface PresetTheme {
  name: string;
  description: string;
  colors: string[];
  fonts: string[];
  style: 'minimal' | 'corporate' | 'editorial' | 'startup';
}

const PRESETS: PresetTheme[] = [
  {
    name: 'minimal',
    description: 'Clean, minimal design with neutral colors and ample whitespace',
    colors: ['#fafafa', '#18181b', '#3b82f6'],
    fonts: ['Inter', 'system-ui'],
    style: 'minimal',
  },
  {
    name: 'corporate',
    description: 'Professional, business-focused design with structured layouts',
    colors: ['#ffffff', '#1e3a8a', '#2563eb', '#475569'],
    fonts: ['Inter', 'Georgia'],
    style: 'corporate',
  },
  {
    name: 'editorial',
    description: 'Magazine-style with serif headings and generous typography',
    colors: ['#fefce8', '#1c1917', '#dc2626', '#1c1917'],
    fonts: ['Playfair Display', 'Merriweather'],
    style: 'editorial',
  },
  {
    name: 'startup',
    description: 'Modern, tech startup aesthetic with bold colors and clean lines',
    colors: ['#0f172a', '#6366f1', '#8b5cf6', '#ec4899'],
    fonts: ['Inter', 'system-ui'],
    style: 'startup',
  },
];

/**
 * Clone design from a URL
 */
export async function cloneDesign(url: string, outputDir?: string): Promise<CloneResult> {
  try {
    const design = await analyzePage(url);
    
    if (!outputDir) {
      outputDir = `./theme-output/${Date.now()}`;
    }
    
    const theme = await generateTheme(design, outputDir);
    const themeId = await saveDraft(theme);
    
    return {
      success: true,
      themeId,
      url: design.url,
      message: `Theme generated from ${url}`,
      tokens: {
        colors: design.colors.primary.length + design.colors.neutral.length,
        typography: design.typography.fontFamilies.length,
        spacing: design.spacing.paddings.length,
        borders: design.borders.borderRadii.length,
        shadows: design.shadows.boxShadows.length,
      },
      components: ['Header', 'Footer', 'ArticleCard', 'Button', 'Callout'],
      warnings: [],
    };
  } catch (error) {
    return {
      success: false,
      url,
      message: `Failed to clone ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * List available preset themes
 */
export function listPresets(): PresetTheme[] {
  return PRESETS;
}

/**
 * Apply a preset theme
 */
export function applyPreset(presetName: string): CloneResult {
  const preset = PRESETS.find(p => p.name === presetName.toLowerCase());
  
  if (!preset) {
    return {
      success: false,
      message: `Preset '${presetName}' not found. Available: ${PRESETS.map(p => p.name).join(', ')}`,
    };
  }
  
  return {
    success: true,
    themeId: `preset-${preset.name}`,
    message: `Preset '${preset.name}' applied: ${preset.description}`,
  };
}

/**
 * Review a generated theme
 */
export async function reviewTheme(themeId: string): Promise<{ success: boolean; message: string; drafts?: any[] }> {
  const drafts = await listDrafts();
  const draft = drafts.find((d: { id: string; name?: string }) => d.id === themeId);
  
  if (!draft) {
    return { success: false, message: `Theme draft '${themeId}' not found` };
  }
  
  return {
    success: true,
    message: `Reviewing theme: ${draft.name}`,
    drafts: [draft],
  };
}

/**
 * Approve and activate a theme
 */
export async function approveThemeAndActivate(themeId: string): Promise<CloneResult> {
  try {
    await approveTheme(themeId);
    return {
      success: true,
      themeId,
      message: `Theme '${themeId}' approved and activated`,
    };
  } catch (error) {
    return {
      success: false,
      themeId,
      message: `Failed to approve theme: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Regenerate a theme
 */
export async function regenerateThemeWithId(themeId: string): Promise<CloneResult> {
  try {
    await regenerateTheme(themeId);
    return {
      success: true,
      themeId,
      message: `Theme '${themeId}' regenerated`,
    };
  } catch (error) {
    return {
      success: false,
      themeId,
      message: `Failed to regenerate: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
