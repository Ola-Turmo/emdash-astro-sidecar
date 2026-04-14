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
  editorialTakeaways?: string[];
  practicalSteps?: string[];
  editorialLead?: string;
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
  salesNote: string;
  summaryRows: Array<{ label: string; value: string }>;
};

const linkKinds: Record<string, { label: string; note: string }> = {
  plan: {
    label: 'Alkoholpolitisk plan',
    note: 'Åpne denne for å se hvordan kommunen beskriver skjenketider og lokale prioriteringer.',
  },
  forms: {
    label: 'Skjema og selvbetjening',
    note: 'Bruk denne når du skal sende inn søknad eller finne skjemaene kommunen viser til.',
  },
  publicRecords: {
    label: 'Innsyn og offentlig journal',
    note: 'Her kan du se postlister, saker og tidligere behandling i kommunen.',
  },
  serviceHub: {
    label: 'Salg, servering og skjenking',
    note: 'Dette er hovedsiden kommunen bruker for regler, krav og videre lenker.',
  },
  application: {
    label: 'Søke bevilling eller gjøre endringer',
    note: 'Åpne denne hvis du skal søke, melde endringer eller følge kommunens søknadsprosess.',
  },
  rules: {
    label: 'Regler og lokale vilkår',
    note: 'Denne siden er nyttig når du vil lese lokale vilkår før du søker eller planlegger drift.',
  },
  sales: {
    label: 'Salgsbevilling',
    note: 'Åpne denne hvis du skal selge alkohol fra butikk eller utsalgssted.',
  },
  serving: {
    label: 'Skjenkebevilling',
    note: 'Åpne denne hvis du skal servere alkohol og vil se kommunens egne regler.',
  },
  servering: {
    label: 'Serveringsbevilling',
    note: 'Denne forklarer serveringsbevilling og hva kommunen krever før oppstart.',
  },
  fees: {
    label: 'Gebyr og satser',
    note: 'Her finner du gebyrer eller satser som er relevante før du søker eller fornyer.',
  },
  renewal: {
    label: 'Fornyelse av bevilling',
    note: 'Åpne denne når bevillingen skal fornyes eller perioden nærmer seg slutten.',
  },
  controls: {
    label: 'Kontroll og tilsyn',
    note: 'Denne viser hva kommunen følger opp etter at bevillingen er gitt.',
  },
  outdoor: {
    label: 'Uteservering',
    note: 'Åpne denne hvis du skal bruke uteareal eller søke om uteservering.',
  },
  singleEvent: {
    label: 'Enkeltanledning og arrangement',
    note: 'Denne er relevant for arrangement, enkeltanledninger og midlertidige behov.',
  },
  exam: {
    label: 'Prøver og kunnskapskrav',
    note: 'Her ser du om kommunen viser til prøver, kunnskapskrav eller kurs.',
  },
  general: {
    label: 'Relevant kommuneside',
    note: 'Dette er en lokal side som er relevant for bevilling eller oppfølging.',
  },
};

const bannedUrlFragments = ['gravplass', 'barnehage', 'skole', 'feiing', 'bal-og-grill', 'bygg', 'anlegg', 'rabattordning'];

export function deriveMunicipalityView(data: MunicipalityData): MunicipalityViewModel {
  const curatedLinks = uniqueByKey(
    uniqueByUrl([
      ...(data.alcoholPolicyPlanUrl ? [{ label: 'Alkoholpolitisk plan', url: data.alcoholPolicyPlanUrl, note: '' }] : []),
      ...(data.formsUrl ? [{ label: 'Skjema og selvbetjening', url: data.formsUrl, note: '' }] : []),
      ...(data.publicRecordsUrl ? [{ label: 'Innsyn og offentlig journal', url: data.publicRecordsUrl, note: '' }] : []),
      ...data.serviceLinks,
      ...data.regulationsLinks,
      ...data.bylawLinks,
    ])
      .map((entry) => decorateLink(entry))
      .filter((entry) => !bannedUrlFragments.some((fragment) => entry.url.toLowerCase().includes(fragment)))
      .filter((entry) => entry.kind !== 'general' || entry.url.toLowerCase().includes('alkohol') || entry.url.toLowerCase().includes('bevilling')),
    (entry) => `${entry.kind}|${entry.displayLabel}`,
  ).slice(0, 6);

  const timeline = buildTimeline(data);
  const salesNote = buildSalesNote(curatedLinks, timeline);
  const facts = buildFacts(data, curatedLinks, timeline);
  const highlights = uniqueValues((data.editorialTakeaways || []).map((entry) => normalizeText(entry))).length
    ? uniqueValues((data.editorialTakeaways || []).map((entry) => normalizeText(entry))).slice(0, 4)
    : buildHighlights(data, curatedLinks, timeline);
  const usefulSources = data.officialSources
    .filter((entry) => entry.url)
    .map((entry) => ({
      ...entry,
      summary: hasValuableMunicipalitySummary(entry.summary) ? normalizeText(entry.summary || '') : undefined,
    }))
    .filter((entry) => hasPermitSignal(`${entry.label} ${entry.title || ''} ${entry.summary || ''}`))
    .filter((entry) => entry.summary)
    .slice(0, 4);
  const checklist = uniqueValues([
    ...(data.practicalSteps || []).map((entry) => normalizeText(entry)),
    ...data.localChecklist.map((entry) => normalizeText(entry)),
    salesNote ? 'Kontroller salgstid direkte på plan- eller salgsbevillingssiden hvis kommunen ikke oppgir et tydelig klokkeslett.' : '',
  ]).slice(0, 6);
  const summaryRows = buildSummaryRows(data, timeline, curatedLinks, salesNote);

  return {
    facts,
    highlights,
    timeline,
    curatedLinks,
    usefulSources,
    checklist,
    lead: normalizeText(data.editorialLead || '') || buildLead(data, timeline, curatedLinks, salesNote),
    cardSummary: buildCardSummary(data, facts, highlights),
    salesNote,
    summaryRows,
  };
}

function buildTimeline(data: MunicipalityData) {
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

  return uniqueByKey(
    timeline,
    (entry) => `${entry.kind}|${entry.label}|${entry.days}|${entry.startTime}|${entry.endTime}|${entry.note}`,
  ).slice(0, 6);
}

function buildFacts(
  data: MunicipalityData,
  curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>,
  timeline: MunicipalityTimelineEntry[],
) {
  const facts: string[] = [];

  const servingEntries = timeline.filter((entry) => entry.kind === 'serving').slice(0, 3);
  for (const entry of servingEntries) {
    const window = formatWindow(entry, ' · ');
    if (window) {
      facts.push(`${capitalize(entry.label)}: ${window}.`);
    }
  }

  const openingEntries = timeline.filter((entry) => entry.kind === 'opening').slice(0, 2);
  for (const openingEntry of openingEntries) {
    const window = formatWindow(openingEntry, ' · ');
    if (window) {
      facts.push(`${capitalize(openingEntry.label)}: ${window}.`);
    }
  }

  const specialKinds = uniqueValues(
    curatedLinks
      .map((entry) => entry.kind)
      .filter((kind) => ['fees', 'renewal', 'controls', 'singleEvent', 'outdoor', 'exam', 'application', 'rules'].includes(kind))
      .map((kind) => linkKinds[kind].label.toLowerCase()),
  );
  if (specialKinds.length) {
    facts.push(`Du finner egne kommunesider for ${joinHumanList(specialKinds)}.`);
  }

  if (data.publicRecordsPlatform) {
    facts.push(`Innsyn går via ${normalizeText(data.publicRecordsPlatform)}, så du kan se saker og vedtak der.`);
  }

  if (data.municipalitySitePlatform) {
    facts.push('Det lønner seg å følge kommunens egne temasider når du trenger oppdatert lokal informasjon.');
  }

  return uniqueValues(facts).slice(0, 4);
}

function buildHighlights(
  data: MunicipalityData,
  curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>,
  timeline: MunicipalityTimelineEntry[],
) {
  const highlights: string[] = [];

  const planSource = data.officialSources.find((entry) => /plan|skjenketider|alkohol/i.test(`${entry.label} ${entry.title || ''}`));
  if (planSource?.title && !/kommune$/i.test(planSource.title) && !looksGenericSourceSummary(planSource.summary)) {
    highlights.push(`${normalizeText(planSource.title)}.`);
  }

  const applicationLink = curatedLinks.find((entry) => entry.kind === 'application');
  if (applicationLink) {
    highlights.push(`${data.municipality} har en egen side for søknad og endringer, så du slipper å lete gjennom hovedsiden når du skal gjøre noe konkret.`);
  }

  const rulesLink = curatedLinks.find((entry) => entry.kind === 'rules' || entry.kind === 'plan');
  if (rulesLink) {
    highlights.push(`Kommunen skiller tydelig mellom praktisk søknad og lokale vilkår, noe som gjør det lettere å kontrollere reglene før du søker.`);
  }

  const examLink = curatedLinks.find((entry) => entry.kind === 'exam');
  if (examLink) {
    highlights.push(`${data.municipality} peker også til prøve- eller kunnskapskrav på egne sider, noe som er nyttig før du sender søknad.`);
  }

  const publicRecordsLink = curatedLinks.find((entry) => entry.kind === 'publicRecords');
  if (publicRecordsLink && data.publicRecordsPlatform) {
    highlights.push(`Tidligere saker kan spores i ${data.publicRecordsPlatform}, så du kan sammenligne praksis med det kommunen skriver på temasidene nå.`);
  }

  const outdoorEntry = timeline.find((entry) => /ute/i.test(entry.label) || /ute/i.test(entry.note));
  if (outdoorEntry) {
    highlights.push(normalizeText(outdoorEntry.note));
  }

  const lateServingEntry = timeline
    .filter((item) => item.kind === 'serving' || item.kind === 'opening')
    .find((item) => toTimeMinutes(item.endTime) >= toTimeMinutes('03:00'));
  if (lateServingEntry) {
    highlights.push(`${data.municipality} åpner for sen drift sammenlignet med mange andre kommuner. Det bør du kontrollere opp mot konsept, naboer og intern drift før søknad.`);
  }

  const consumptionStopEntry = timeline.find((item) => /30 minutter|konsum/i.test(item.note));
  if (consumptionStopEntry) {
    highlights.push(`Kommunen presiserer at konsum må opphøre etter skjenkeslutt. Det er viktig å få inn i rutiner og opplæring.`);
  }

  return uniqueValues(highlights)
    .filter((entry) => entry.length >= 35)
    .slice(0, 4);
}

function decorateLink(entry: LinkEntry) {
  const kind = classifyLinkKind(entry.url, entry.label);
  const definition = linkKinds[kind] || linkKinds.general;
  const forceKindLabel = ['plan', 'serviceHub', 'application', 'rules', 'forms', 'publicRecords'].includes(kind);
  return {
    ...entry,
    kind,
    displayLabel: forceKindLabel || needsDerivedLabel(entry.label) ? definition.label : normalizeText(entry.label),
    displayNote: normalizeText(entry.note || definition.note),
  };
}

function buildLead(
  data: MunicipalityData,
  timeline: MunicipalityTimelineEntry[],
  curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>,
  salesNote: string,
) {
  const servingEntry = timeline.find((entry) => entry.kind === 'serving');
  const planLink = curatedLinks.find((entry) => entry.kind === 'plan');
  const applicationLink = curatedLinks.find((entry) => entry.kind === 'application' || entry.kind === 'forms');
  const parts: string[] = [];

  if (servingEntry) {
    const window = formatWindow(servingEntry);
    if (window) {
      parts.push(`Her ser du hva ${data.municipality} oppgir om skjenking ${window}.`);
    }
  } else {
    parts.push(`Her får du en rask oversikt over lokale regler og nyttige kommunesider i ${data.municipality}.`);
  }

  if (planLink && applicationLink) {
    parts.push(`Vi peker deg videre til både ${planLink.displayLabel.toLowerCase()} og siden for søknad eller endringer.`);
  } else if (planLink) {
    parts.push(`Vi peker deg videre til ${planLink.displayLabel.toLowerCase()} når du trenger originalkilden.`);
  } else if (applicationLink) {
    parts.push('Vi peker deg videre til siden for søknad eller endringer når du skal gjøre noe konkret.');
  }

  if (salesNote) {
    parts.push('Salgstid må fortsatt dobbeltsjekkes mot kommunens egne sider hvis den ikke er tydelig oppgitt.');
  }

  return parts.join(' ');
}

function classifyLinkKind(url: string, label: string) {
  const source = `${url} ${label}`.toLowerCase();
  if (/handlingsplan|alkoholpolitisk|skjenketider|retningslinje/.test(source)) return 'plan';
  if (/soke-bevilling|søke-bevilling|gjore-endringer|gjøre-endringer/.test(source)) return 'application';
  if (/regler-for|lokale-regler|skjenketider/.test(source)) return 'rules';
  if (/salg-servering-og-skjenking|alkohol-og-servering/.test(source)) return 'serviceHub';
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
  if ((rule.days || '').match(/juli|august|desember/i)) return 'utvidet åpningstid';
  if (rule.appliesTo === 'serving_place') return 'serveringssted';
  return normalizeText(rule.appliesTo || 'åpningstid');
}

function formatWindow(entry: MunicipalityTimelineEntry, joiner = ', ') {
  const parts = [];
  if (entry.days) parts.push(entry.days);
  if (entry.startTime && entry.endTime) parts.push(`${entry.startTime}–${entry.endTime}`);
  else if (entry.endTime) parts.push(`til ${entry.endTime}`);
  else if (entry.startTime) parts.push(`fra ${entry.startTime}`);
  return parts.join(joiner);
}

function buildSummaryRows(
  data: MunicipalityData,
  timeline: MunicipalityTimelineEntry[],
  curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>,
  salesNote: string,
) {
  const rows: Array<{ label: string; value: string }> = [];
  const servingEntries = timeline.filter((entry) => entry.kind === 'serving').slice(0, 2);
  const openingEntries = timeline.filter((entry) => entry.kind === 'opening').slice(0, 2);
  for (const entry of servingEntries) {
    rows.push({ label: capitalize(entry.label), value: formatWindow(entry, ' · ') || normalizeText(entry.note) });
  }
  for (const entry of openingEntries) {
    rows.push({ label: capitalize(entry.label), value: formatWindow(entry, ' · ') || normalizeText(entry.note) });
  }
  const applicationLink = curatedLinks.find((entry) => ['application', 'forms'].includes(entry.kind));
  if (applicationLink) {
    rows.push({ label: 'Søknad', value: applicationLink.displayLabel });
  }
  if (data.publicRecordsPlatform) {
    rows.push({ label: 'Innsyn', value: normalizeText(data.publicRecordsPlatform) });
  }
  if (salesNote) {
    rows.push({ label: 'Salg', value: 'Må kontrolleres på kommunens egne sider' });
  }
  return uniqueByKey(rows, (entry) => `${entry.label}|${entry.value}`).slice(0, 6);
}

function buildCardSummary(data: MunicipalityData, facts: string[], highlights: string[]) {
  const firstFact = facts[0];
  const secondFact = facts[1];
  if (firstFact && secondFact) {
    return `${firstFact} ${secondFact}`;
  }
  return firstFact || highlights[0] || `Se lokale regler og nyttige kommunesider for ${data.municipality}.`;
}

function looksGenericSourceSummary(summary?: string) {
  const text = normalizeText(summary || '');
  if (!text) return true;
  return /legevakt|barnevern|vann- og avløp|overgrepsmottak|stedet for å finne tjenester|postboks|telefon|talende web|fingeren på|organisasjonsnummer|bankkontonummer|faktura til kommunen|for leverandører|skriv til oss|send sikker digital post|meld feil|sifra/i.test(
    text,
  );
}

function hasValuableMunicipalitySummary(summary?: string) {
  const text = normalizeText(summary || '');
  if (!text || looksGenericSourceSummary(text)) return false;
  if (!hasPermitSignal(text)) return false;
  return text.length >= 50;
}

function hasPermitSignal(value: string) {
  return /(bevilling|skjenk|salg|servering|innsyn|journal|skjema|søknad|kontroll|gebyr|uteserver|arrangement|prøve|prove|kunnskap)/iu.test(
    normalizeText(value),
  );
}

function buildSalesNote(
  curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>,
  timeline: MunicipalityTimelineEntry[],
) {
  if (timeline.some((entry) => entry.kind === 'sales')) return '';
  const salesLink = curatedLinks.find((entry) => ['sales', 'rules', 'serviceHub'].includes(entry.kind));
  if (!salesLink) return '';
  return `Vi fant ikke en tydelig salgstid i kildene vi har kontrollert. Åpne ${salesLink.displayLabel.toLowerCase()} før du fastsetter lokale salgstider.`;
}

function normalizeTime(value: string) {
  return normalizeText(value).replace('.', ':');
}

function toTimeMinutes(value: string) {
  const normalized = normalizeTime(value);
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
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
    if (!/[ÃƒÃ‚]/.test(normalized)) break;
    const repaired = Buffer.from(normalized, 'latin1').toString('utf8');
    if (countMarkers(repaired) > countMarkers(normalized)) break;
    normalized = repaired;
  }
  return normalized
    .replace(/aapaingstider/gi, 'åpningstider')
    .replace(/aapaingstid/gi, 'åpningstid')
    .replace(/aapent/gi, 'åpent')
    .replace(/aapen/gi, 'åpen')
    .replace(/saerskilt/gi, 'særskilt')
    .replace(/soeke/gi, 'søke')
    .replace(/fraa/gi, 'fra')
    .replace(/loesning/gi, 'løsning');
}

function countMarkers(value: string) {
  return [...String(value || '')].filter((character) => character === 'Ãƒ' || character === 'Ã‚').length;
}
