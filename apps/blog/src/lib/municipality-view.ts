type LinkEntry = {
  label: string;
  url: string;
  note?: string;
};

type SourceEntry = {
  label: string;
  url: string;
  title?: string;
  summary?: string;
};

type OpeningRule = {
  appliesTo?: string;
  days?: string;
  startTime?: string;
  endTime?: string;
  note: string;
};

type ServingRule = {
  area?: string;
  groups?: string[];
  days?: string;
  startTime?: string;
  endTime?: string;
  note: string;
};

type MunicipalityData = {
  municipality: string;
  county?: string;
  publicRecordsPlatform?: string;
  municipalitySitePlatform?: string;
  serviceLinks: LinkEntry[];
  regulationsLinks: LinkEntry[];
  bylawLinks: LinkEntry[];
  officialSources: SourceEntry[];
  localChecklist: string[];
  openingHoursRules: OpeningRule[];
  alcoholServingRules: ServingRule[];
  formsUrl?: string;
  publicRecordsUrl?: string;
  alcoholPolicyPlanUrl?: string;
};

export type MunicipalityTimelineEntry = {
  kind: 'sales' | 'serving' | 'opening';
  label: string;
  days: string;
  startTime: string;
  endTime: string;
  note: string;
  certainty: 'high' | 'low';
};

export type MunicipalityViewModel = {
  facts: string[];
  highlights: string[];
  timeline: MunicipalityTimelineEntry[];
  curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>;
  usefulSources: SourceEntry[];
  checklist: string[];
  lead: string;
  cardSummary: string;
};

const linkKinds: Record<string, { label: string; note: string }> = {
  plan: {
    label: 'Alkoholpolitisk plan',
    note: 'Siden peker til kommunens egne retningslinjer eller lokale tider.',
  },
  forms: {
    label: 'Skjema og selvbetjening',
    note: 'Her ligger skjemaene kommunen faktisk ber deg bruke.',
  },
  publicRecords: {
    label: 'Innsyn og offentlig journal',
    note: 'Her kan du følge saker, postlister og tidligere behandling.',
  },
  sales: {
    label: 'Salgsbevilling',
    note: 'Kommunen har en egen side for salg av alkohol.',
  },
  serving: {
    label: 'Skjenkebevilling',
    note: 'Kommunen har en egen side for skjenking og skjenketider.',
  },
  servering: {
    label: 'Serveringsbevilling',
    note: 'Kommunen har en egen side for serveringsbevilling.',
  },
  fees: {
    label: 'Gebyr og satser',
    note: 'Kommunen publiserer egne gebyrer eller satser for bevillinger.',
  },
  renewal: {
    label: 'Fornyelse av bevilling',
    note: 'Kommunen har et eget spor for fornyelse av bevillingsperioden.',
  },
  controls: {
    label: 'Kontroll og tilsyn',
    note: 'Kommunen beskriver kontroll eller tilsyn etter at bevilling er gitt.',
  },
  outdoor: {
    label: 'Uteservering',
    note: 'Kommunen har en egen side for uteservering eller bruk av uteareal.',
  },
  singleEvent: {
    label: 'Enkeltanledning og arrangement',
    note: 'Kommunen skiller mellom faste bevillinger og enkeltarrangement.',
  },
  exam: {
    label: 'Prøver og kunnskapskrav',
    note: 'Kommunen peker på prøver, kurs eller kunnskapskrav.',
  },
  general: {
    label: 'Relevant kommuneside',
    note: 'Dette er en lokal side for bevillinger eller praktisk oppfølging.',
  },
};

const bannedUrlFragments = ['gravplass', 'barnehage', 'skole', 'feiing', 'bal-og-grill', 'bygg', 'anlegg', 'rabattordning'];

export function deriveMunicipalityView(data: MunicipalityData): MunicipalityViewModel {
  const curatedLinks = uniqueByUrl([
    ...(data.alcoholPolicyPlanUrl ? [{ label: 'Alkoholpolitisk plan', url: data.alcoholPolicyPlanUrl, note: '' }] : []),
    ...(data.formsUrl ? [{ label: 'Skjema og selvbetjening', url: data.formsUrl, note: '' }] : []),
    ...(data.publicRecordsUrl ? [{ label: 'Innsyn og offentlig journal', url: data.publicRecordsUrl, note: '' }] : []),
    ...data.serviceLinks,
    ...data.regulationsLinks,
    ...data.bylawLinks,
  ])
    .map((entry) => decorateLink(entry))
    .filter((entry) => !bannedUrlFragments.some((fragment) => entry.url.toLowerCase().includes(fragment)))
    .filter((entry) => entry.kind !== 'general' || entry.url.toLowerCase().includes('alkohol') || entry.url.toLowerCase().includes('bevilling'))
    .slice(0, 8);

  const timeline = buildTimeline(data, curatedLinks);
  const facts = buildFacts(data, curatedLinks, timeline);
  const highlights = buildHighlights(data, curatedLinks, timeline);
  const usefulSources = data.officialSources
    .filter((entry) => entry.url)
    .filter((entry) => !looksGenericSourceSummary(entry.summary))
    .slice(0, 4);
  const checklist = uniqueValues([
    ...data.localChecklist.map((entry) => normalizeText(entry)),
    timeline.some((entry) => entry.kind === 'sales' && entry.certainty === 'low')
      ? 'Kontroller salgstid direkte på plan- eller salgsbevillingssiden hvis kommunen ikke oppgir et tydelig klokkeslett i datagrunnlaget.'
      : '',
  ]).slice(0, 6);

  return {
    facts,
    highlights,
    timeline,
    curatedLinks,
    usefulSources,
    checklist,
    lead: facts.slice(0, 2).join(' '),
    cardSummary: facts[0] || highlights[0] || `Se lokale regler og lenker for ${data.municipality}.`,
  };
}

function buildTimeline(data: MunicipalityData, curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>) {
  const timeline: MunicipalityTimelineEntry[] = [];

  for (const rule of data.alcoholServingRules) {
    timeline.push({
      kind: 'serving',
      label: buildServingLabel(rule),
      days: normalizeText(rule.days || ''),
      startTime: normalizeTime(rule.startTime || ''),
      endTime: normalizeTime(rule.endTime || ''),
      note: normalizeText(rule.note),
      certainty: 'high',
    });
  }

  for (const rule of data.openingHoursRules) {
    timeline.push({
      kind: 'opening',
      label: buildOpeningLabel(rule),
      days: normalizeText(rule.days || ''),
      startTime: normalizeTime(rule.startTime || ''),
      endTime: normalizeTime(rule.endTime || ''),
      note: normalizeText(rule.note),
      certainty: 'high',
    });
  }

  const saleLink = curatedLinks.find((entry) => entry.kind === 'sales');
  if (saleLink) {
    timeline.push({
      kind: 'sales',
      label: 'Salg av alkohol',
      days: '',
      startTime: '',
      endTime: '',
      note: 'Kommunen har en egen side for salgsbevilling, men datagrunnlaget oppgir ikke alltid et eksplisitt klokkeslett for salg. Åpne siden før du fastsetter salgstid lokalt.',
      certainty: 'low',
    });
  }

  return uniqueByKey(
    timeline,
    (entry) => `${entry.kind}|${entry.label}|${entry.days}|${entry.startTime}|${entry.endTime}|${entry.note}`,
  ).slice(0, 8);
}

function buildFacts(data: MunicipalityData, curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>, timeline: MunicipalityTimelineEntry[]) {
  const facts: string[] = [];

  if (data.county) {
    facts.push(`${data.municipality} følger sine egne kommunale alkoholregler, selv om kommunen ligger i ${normalizeText(data.county)}.`);
  }

  const servingEntries = timeline.filter((entry) => entry.kind === 'serving').slice(0, 2);
  for (const entry of servingEntries) {
    const window = formatWindow(entry);
    if (window) {
      facts.push(`${capitalize(entry.label)} gjelder ${window}.`);
    }
  }

  const openingEntry = timeline.find((entry) => entry.kind === 'opening');
  if (openingEntry) {
    const window = formatWindow(openingEntry);
    facts.push(`${capitalize(openingEntry.label)} er lagt opp ${window}.`.replace(/\s+\./g, '.'));
  }

  const specialKinds = uniqueValues(
    curatedLinks
      .map((entry) => entry.kind)
      .filter((kind) => ['fees', 'renewal', 'controls', 'singleEvent', 'outdoor', 'exam'].includes(kind))
      .map((kind) => linkKinds[kind].label.toLowerCase()),
  );
  if (specialKinds.length) {
    facts.push(`${data.municipality} har egne sider for ${joinHumanList(specialKinds)}.`);
  }

  if (data.publicRecordsPlatform) {
    facts.push(`Innsyn går via ${normalizeText(data.publicRecordsPlatform)}, så du kan følge lokale saker og vedtak der.`);
  }

  if (data.municipalitySitePlatform) {
    facts.push(`Kommunen publiserer innholdet sitt på ${normalizeText(data.municipalitySitePlatform)}, så det lønner seg å følge temasidene direkte.`);
  }

  return uniqueValues(facts).slice(0, 4);
}

function buildHighlights(data: MunicipalityData, curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>, timeline: MunicipalityTimelineEntry[]) {
  const highlights: string[] = [];

  const serviceSource = data.officialSources.find((entry) => /salg|skjenk|servering/i.test(`${entry.label} ${entry.title || ''}`));
  if (serviceSource?.summary && !looksGenericSourceSummary(serviceSource.summary)) {
    highlights.push(normalizeText(serviceSource.summary));
  }

  const outdoorEntry = timeline.find((entry) => /ute/i.test(entry.label) || /ute/i.test(entry.note));
  if (outdoorEntry) {
    highlights.push(normalizeText(outdoorEntry.note));
  }

  for (const entry of curatedLinks) {
    if (['fees', 'renewal', 'controls', 'singleEvent', 'outdoor', 'exam'].includes(entry.kind)) {
      highlights.push(entry.displayNote);
    }
  }

  for (const entry of timeline.filter((item) => item.certainty === 'high')) {
    highlights.push(normalizeText(entry.note));
  }

  return uniqueValues(highlights).filter((entry) => entry.length >= 40).slice(0, 6);
}

function decorateLink(entry: LinkEntry) {
  const kind = classifyLinkKind(entry.url, entry.label);
  const definition = linkKinds[kind] || linkKinds.general;
  return {
    ...entry,
    kind,
    displayLabel: needsDerivedLabel(entry.label) ? definition.label : normalizeText(entry.label),
    displayNote: normalizeText(entry.note || definition.note),
  };
}

function classifyLinkKind(url: string, label: string) {
  const source = `${url} ${label}`.toLowerCase();
  if (/skjema|ekstern\/veiledere|\/skjema/.test(source)) return 'forms';
  if (/innsyn|journal|einnsyn/.test(source)) return 'publicRecords';
  if (/uteserver|offentlig-areal/.test(source)) return 'outdoor';
  if (/enkelt.?anledning|arrangement/.test(source)) return 'singleEvent';
  if (/gebyr|satser/.test(source)) return 'fees';
  if (/fornyelse|fornye/.test(source)) return 'renewal';
  if (/kontroll/.test(source)) return 'controls';
  if (/prove|prøve|kunnskap|etablerer/.test(source)) return 'exam';
  if (/salgsbevilling|salg/.test(source)) return 'sales';
  if (/serveringsbevilling|servering/.test(source)) return 'servering';
  if (/skjenkebevilling|skjenking|alkohol/.test(source)) return 'serving';
  if (/plan|retningslinje|skjenketider/.test(source)) return 'plan';
  return 'general';
}

function needsDerivedLabel(label: string) {
  return /relevant kommuneside|forskrift \d+|vedtekt \d+/i.test(label);
}

function buildServingLabel(rule: ServingRule) {
  const groups = Array.isArray(rule.groups) && rule.groups.length ? `gruppe ${rule.groups.join(', ')}` : 'skjenking';
  if (rule.area && rule.area !== 'all' && rule.area !== 'unspecified') {
    return `${groups}, ${normalizeText(rule.area)}`;
  }
  return groups;
}

function buildOpeningLabel(rule: OpeningRule) {
  if (rule.appliesTo === 'outdoor_area') return 'uteservering';
  if (rule.appliesTo === 'serving_place') return 'serveringssted';
  return normalizeText(rule.appliesTo || 'åpningstid');
}

function formatWindow(entry: MunicipalityTimelineEntry) {
  const parts = [];
  if (entry.days) parts.push(entry.days);
  if (entry.startTime && entry.endTime) parts.push(`${entry.startTime}–${entry.endTime}`);
  else if (entry.endTime) parts.push(`til ${entry.endTime}`);
  else if (entry.startTime) parts.push(`fra ${entry.startTime}`);
  return parts.join(', ');
}

function looksGenericSourceSummary(summary?: string) {
  const text = normalizeText(summary || '');
  if (!text) return true;
  return /legevakt|barnevern|vann- og avløp|overgrepsmottak/i.test(text);
}

function normalizeTime(value: string) {
  return normalizeText(value).replace('.', ':');
}

function capitalize(value: string) {
  const normalized = normalizeText(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function joinHumanList(entries: string[]) {
  if (!entries.length) return '';
  if (entries.length === 1) return entries[0];
  if (entries.length === 2) return `${entries[0]} og ${entries[1]}`;
  return `${entries.slice(0, -1).join(', ')} og ${entries[entries.length - 1]}`;
}

function uniqueByUrl<T extends { url: string }>(entries: T[]) {
  return uniqueByKey(entries, (entry) => entry.url);
}

function uniqueValues(entries: string[]) {
  return [...new Set(entries.map((entry) => normalizeText(entry)).filter(Boolean))];
}

function uniqueByKey<T>(entries: T[], keyFn: (entry: T) => string) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = keyFn(entry);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeText(value: string) {
  return decodeCommonMojibake(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeCommonMojibake(value: string) {
  let normalized = String(value ?? '');
  for (let index = 0; index < 2; index += 1) {
    if (!/[ÃÂ]/.test(normalized)) break;
    const repaired = Buffer.from(normalized, 'latin1').toString('utf8');
    if (countMarkers(repaired) > countMarkers(normalized)) break;
    normalized = repaired;
  }
  return normalized
    .replace(/aapaingstider/gi, 'åpningstider')
    .replace(/aapent/gi, 'åpent')
    .replace(/aapen/gi, 'åpen')
    .replace(/saerskilt/gi, 'særskilt')
    .replace(/soeke/gi, 'søke')
    .replace(/fraa/gi, 'fra')
    .replace(/loesning/gi, 'løsning');
}

function countMarkers(value: string) {
  return [...String(value || '')].filter((character) => character === 'Ã' || character === 'Â').length;
}
