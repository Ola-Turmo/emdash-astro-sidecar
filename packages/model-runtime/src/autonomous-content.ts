export interface AutonomousInternalLink {
  label: string;
  url: string;
  reason?: string;
}

export interface AutonomousSourceExcerpt {
  title: string;
  excerpt: string;
  url?: string | null;
}

export interface AutonomousDraftRequest {
  topic: string;
  hostName: string;
  siteUrl: string;
  basePath: string;
  sourceExcerpts: AutonomousSourceExcerpt[];
  internalLinks: AutonomousInternalLink[];
}

export interface AutonomousDraftArtifact {
  title: string;
  description: string;
  excerpt: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
  suggestedTags: string[];
  wordCount: number;
  qualityNotes: string[];
}

const BANNED_VISIBLE_TERMS = [
  'geo',
  'seo',
  'sidecar',
  'innholdsbølge',
  'programmatic seo',
  'ai crawler',
  'serp',
];

export function buildAutonomousDraftPrompt(input: AutonomousDraftRequest): string {
  const guideUrl = buildGuideRootUrl(input.siteUrl, input.basePath);
  const linkLines = input.internalLinks.length
    ? input.internalLinks
        .map((link) => `- ${link.label}: ${link.url}${link.reason ? ` (${link.reason})` : ''}`)
        .join('\n')
    : '- Hjemmeside: ingen tilgjengelige lenker oppgitt';
  const sourceLines = input.sourceExcerpts.length
    ? input.sourceExcerpts
        .map((source, index) => {
          const suffix = source.url ? ` (${source.url})` : '';
          return `${index + 1}. ${source.title}${suffix}: ${source.excerpt}`;
        })
        .join('\n')
    : 'Ingen kilder er tilgjengelige. Ikke finn på fakta.';

  return [
    'Skriv på norsk for en vanlig leser som prøver å forstå et praktisk spørsmål før kjøp eller før prøve.',
    `Tema: ${input.topic}`,
    `Vertsside: ${input.hostName}`,
    `Hovedside: ${input.siteUrl}`,
    `Guide-rot: ${guideUrl}`,
    '',
    'Synlig tekst må være leserrettet og konkret.',
    'Ikke bruk intern terminologi som SEO, GEO, sidecar, innholdsbølge, topp-trakt eller lignende.',
    'Ikke finn på lover, tall, datoer eller løfter.',
    'Hvis kildene er tynne, hold formuleringene forsiktige.',
    'Legg inn minst to naturlige interne markdown-lenker til relevante sider fra listen under.',
    '',
    'Tillatte interne lenker:',
    linkLines,
    '',
    'Kildesammendrag:',
    sourceLines,
    '',
    'Returner kun gyldig JSON med denne strukturen:',
    '{',
    '  "title": "kort og konkret tittel for leseren",',
    '  "description": "naturlig metabeskrivelse på 100-160 tegn",',
    '  "excerpt": "kort utdrag for kortvisning på 140-220 tegn",',
    '  "sections": [',
    '    { "heading": "overskrift", "body": "2-4 korte avsnitt med markdown-lenker der det hjelper leseren" }',
    '  ],',
    '  "suggestedTags": ["tagg1", "tagg2", "tagg3"]',
    '}',
    '',
    'Krav:',
    '- 3 til 5 seksjoner.',
    '- Minst 320 ord totalt.',
    '- Første seksjon skal svare direkte på spørsmålet.',
    '- Siste seksjon skal hjelpe leseren videre med et trygt neste steg.',
    '- Bruk vanlig norsk og korte setninger.',
  ].join('\n');
}

export function parseAutonomousDraftArtifact(
  value: string,
  fallbackTopic: string,
): AutonomousDraftArtifact {
  const parsed = parseJsonObject(value) as Partial<{
    title: unknown;
    description: unknown;
    excerpt: unknown;
    sections: unknown;
    suggestedTags: unknown;
  }>;

  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .map((section) => normalizeSection(section))
        .filter((section): section is { heading: string; body: string } => Boolean(section))
    : [];

  const artifact: AutonomousDraftArtifact = {
    title: normalizeSentence(parsed.title, toTitle(fallbackTopic)),
    description: clampText(
      normalizeSentence(parsed.description, `Forklaring og neste steg for ${fallbackTopic}.`),
      100,
      160,
    ),
    excerpt: clampText(
      normalizeSentence(parsed.excerpt, `Praktisk guide om ${fallbackTopic}.`),
      140,
      220,
    ),
    sections: sections.length >= 3 ? sections : buildFallbackSections(fallbackTopic, []),
    suggestedTags: normalizeTags(parsed.suggestedTags, fallbackTopic),
    wordCount: 0,
    qualityNotes: [],
  };

  artifact.wordCount = countDraftWords(artifact.sections);
  artifact.qualityNotes = collectQualityNotes(artifact);

  return artifact;
}

export function salvageAutonomousDraftArtifact(
  value: string,
  fallbackTopic: string,
  internalLinks: AutonomousInternalLink[] = [],
): AutonomousDraftArtifact {
  const cleaned = value
    .replace(/```(?:json|markdown)?/gi, '')
    .replace(/\r\n/g, '\n')
    .trim();
  const headingMatches = [...cleaned.matchAll(/^(?:##|#{1,3})\s+(.+)$/gm)];
  const sections: Array<{ heading: string; body: string }> = [];

  if (headingMatches.length >= 2) {
    for (let index = 0; index < headingMatches.length; index += 1) {
      const current = headingMatches[index];
      const next = headingMatches[index + 1];
      const start = (current.index ?? 0) + current[0].length;
      const end = next?.index ?? cleaned.length;
      const heading = current[1]?.trim() ?? '';
      const body = cleaned.slice(start, end).trim();
      if (heading && body) {
        sections.push({ heading, body });
      }
    }
  }

  if (sections.length < 3) {
    const paragraphs = cleaned
      .split(/\n{2,}/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    for (let index = 0; index < paragraphs.length && sections.length < 4; index += 1) {
      const paragraph = paragraphs[index];
      if (paragraph.length < 40) continue;
      sections.push({
        heading:
          index === 0
            ? 'Kort svar'
            : index === paragraphs.length - 1
              ? 'Slik kommer du videre'
              : `Viktig punkt ${sections.length + 1}`,
        body: paragraph,
      });
    }
  }

  const artifact =
    sections.length >= 3
      ? {
          title: toTitle(fallbackTopic),
          description: clampText(
            cleaned.replace(/\s+/g, ' ').slice(0, 160) || `Forklaring og neste steg for ${fallbackTopic}.`,
            100,
            160,
          ),
          excerpt: clampText(
            cleaned.replace(/\s+/g, ' ').slice(0, 220) || `Praktisk guide om ${fallbackTopic}.`,
            140,
            220,
          ),
          sections,
          suggestedTags: normalizeTags([], fallbackTopic),
          wordCount: countDraftWords(sections),
          qualityNotes: ['salvaged-from-raw-provider-text'],
        }
      : buildFallbackDraftArtifact({
          topic: fallbackTopic,
          hostName: '',
          siteUrl: 'https://example.com',
          basePath: '/',
          sourceExcerpts: [],
          internalLinks,
        });

  artifact.qualityNotes = [...new Set([...artifact.qualityNotes, ...collectQualityNotes(artifact)])];
  artifact.wordCount = countDraftWords(artifact.sections);
  return artifact;
}

export function buildFallbackDraftArtifact(input: AutonomousDraftRequest): AutonomousDraftArtifact {
  const sections = buildFallbackSections(input.topic, input.internalLinks);
  const artifact: AutonomousDraftArtifact = {
    title: toTitle(input.topic),
    description: clampText(
      `En enkel forklaring på ${input.topic.toLowerCase()} og hvilke sider hos ${input.hostName} som hjelper deg videre.`,
      100,
      160,
    ),
    excerpt: clampText(
      `Dette er en enkel og praktisk forklaring på ${input.topic.toLowerCase()}, med råd om hva du bør sjekke og hvor du går videre.`,
      140,
      220,
    ),
    sections,
    suggestedTags: normalizeTags([], input.topic),
    wordCount: countDraftWords(sections),
    qualityNotes: ['fallback-draft-used'],
  };

  artifact.qualityNotes.push(...collectQualityNotes(artifact));
  return artifact;
}

export function countDraftWords(
  sections: Array<{
    heading: string;
    body: string;
  }>,
): number {
  return sections
    .map((section) => `${section.heading} ${section.body}`)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeSection(value: unknown): { heading: string; body: string } | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const heading = normalizeSentence(candidate.heading, '');
  const body = sanitizeBody(candidate.body);
  if (!heading || !body) return null;
  return { heading, body };
}

function sanitizeBody(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSentence(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!text) return fallback;
  return text;
}

function normalizeTags(value: unknown, fallbackTopic: string): string[] {
  const base = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : fallbackTopic.split(/\s+/);

  return [...new Set(base.map((entry) => toSlug(entry)).filter(Boolean))].slice(0, 5);
}

function buildFallbackSections(
  topic: string,
  internalLinks: AutonomousInternalLink[],
): Array<{
  heading: string;
  body: string;
}> {
  const primaryLink = internalLinks[0];
  const secondaryLink = internalLinks[1] ?? internalLinks[0];

  return [
    {
      heading: 'Kort svar',
      body: [
        `${toTitle(topic)} handler som regel om å forstå kravene tidlig, ikke bare å pugge ord for ord.`,
        'Det viktigste er å få oversikt over hva kommunen forventer, hvilke dokumenter eller temaer som går igjen, og hva som faktisk avgjør om du føler deg trygg før prøven.',
        primaryLink
          ? `Start med å lese [${primaryLink.label}](${primaryLink.url}) hvis du vil se hovedsiden eller riktig kursvalg.`
          : 'Start med hovedsiden eller riktig kursvalg før du bruker tid på detaljer.',
      ].join('\n\n'),
    },
    {
      heading: 'Hva du bør sjekke først',
      body: [
        'Begynn med pensum, krav og vanlige feil. Da får du raskt oversikt over hva som er praktisk viktig, og hva som bare skaper unødig usikkerhet.',
        'Når du har et klart bilde av hva som forventes, blir det lettere å planlegge lesingen og bruke kursinnholdet riktig.',
        secondaryLink
          ? `Hvis du vil gå videre med neste steg, finner du mer i [${secondaryLink.label}](${secondaryLink.url}).`
          : 'Se etter en tydelig oversikt over pensum, krav og neste steg.',
      ].join('\n\n'),
    },
    {
      heading: 'Slik kommer du videre',
      body: [
        'Leseren bør sitte igjen med et konkret neste steg: velg riktig kurs, gå gjennom vanlige feil og bruk sjekklister eller forklaringer som faktisk gjør prøven mer forståelig.',
        'Det viktigste er ikke å lese mest mulig, men å få kontroll på de punktene som oftest skaper problemer før kjøp eller før prøve.',
      ].join('\n\n'),
    },
  ];
}

function collectQualityNotes(artifact: AutonomousDraftArtifact): string[] {
  const notes: string[] = [];
  if (artifact.sections.length < 3) {
    notes.push('too-few-sections');
  }
  if (artifact.wordCount < 320) {
    notes.push('word-count-below-target');
  }

  const visibleText = [artifact.title, artifact.description, artifact.excerpt]
    .concat(artifact.sections.map((section) => `${section.heading} ${section.body}`))
    .join(' ')
    .toLowerCase();

  for (const term of BANNED_VISIBLE_TERMS) {
    if (visibleText.includes(term)) {
      notes.push(`contains-banned-term:${term}`);
    }
  }

  return [...new Set(notes)];
}

function clampText(value: string, minLength: number, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength && normalized.length >= minLength) {
    return normalized;
  }
  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength).replace(/[,\s]+$/, '');
  }

  return normalized;
}

function toTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Ny guide';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function buildGuideRootUrl(siteUrl: string, basePath: string): string {
  const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const suffix = normalizedBasePath.endsWith('/') ? normalizedBasePath : `${normalizedBasePath}/`;
  return new URL(suffix, siteUrl).toString();
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseJsonObject(value: string): unknown {
  const normalized = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const directCandidate = extractBalancedJsonObject(normalized) ?? normalized;

  try {
    return JSON.parse(directCandidate);
  } catch (error) {
    const repairedCandidate = repairCommonJsonBreakage(directCandidate);
    return JSON.parse(repairedCandidate);
  }
}

function extractBalancedJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return value.slice(start);
}

function repairCommonJsonBreakage(value: string): string {
  return value
    .replace(/[\u0000-\u0019]+/g, ' ')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .trim();
}
