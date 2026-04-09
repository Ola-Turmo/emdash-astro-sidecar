// Types for design-clone extracted data

export interface ExtractedColors {
  primary: string[];
  secondary: string[];
  neutral: string[];
  accent: string[];
  semantic: { success?: string; warning?: string; danger?: string; info?: string };
  cssVariables: Record<string, string>;
  inlineStyles: Record<string, string>;
}

export interface ExtractedTypography {
  fontFamilies: string[];
  fontSizes: { value: string; selector: string }[];
  fontWeights: { value: string; selector: string }[];
  lineHeights: { value: string; selector: string }[];
  letterSpacings: { value: string; selector: string }[];
}

export interface ExtractedSpacing {
  paddings: { value: string; selector: string }[];
  margins: { value: string; selector: string }[];
  gaps: { value: string; selector: string }[];
}

export interface ExtractedBorders {
  borderRadii: { value: string; selector: string }[];
  borderWidths: { value: string; selector: string }[];
  borderColors: { value: string; selector: string }[];
}

export interface ExtractedShadows {
  boxShadows: { value: string; selector: string }[];
}

export interface ExtractedComponents {
  buttons: ButtonStyle[];
  cards: CardStyle[];
  inputs: InputStyle[];
  navItems: NavStyle[];
}

export interface ButtonStyle {
  selector: string;
  padding: string;
  borderRadius: string;
  fontSize: string;
  fontWeight: string;
  backgroundColor: string;
  color: string;
  boxShadow?: string;
  hoverBackgroundColor?: string;
  hoverColor?: string;
}

export interface CardStyle {
  selector: string;
  padding: string;
  borderRadius: string;
  backgroundColor: string;
  border?: string;
  boxShadow?: string;
}

export interface InputStyle {
  selector: string;
  padding: string;
  borderRadius: string;
  border: string;
  fontSize: string;
}

export interface NavStyle {
  selector: string;
  fontSize: string;
  fontWeight: string;
  color: string;
  hoverColor?: string;
  gap?: string;
}

export interface ExtractedLayout {
  containerMaxWidth?: string;
  gridColumns?: number;
  gridGaps?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
}

export interface ExtractedDesign {
  url: string;
  extractedAt: string;
  colors: ExtractedColors;
  typography: ExtractedTypography;
  spacing: ExtractedSpacing;
  borders: ExtractedBorders;
  shadows: ExtractedShadows;
  components: ExtractedComponents;
  layout: ExtractedLayout;
}

export interface ExtractedReport {
  design: ExtractedDesign;
  warnings: string[];
  metadata: {
    title?: string;
    description?: string;
    favicon?: string;
  };
}