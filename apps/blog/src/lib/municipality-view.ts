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
    label: 'Lokale regler og tider',
    note: 'Åpne denne når kommunen faktisk har en egen plan eller side for lokale tider og prioriteringer.',
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
const curatedLinkPriority: Record<string, number> = {
  plan: 0,
  application: 1,
  serving: 2,
  sales: 3,
  rules: 4,
  controls: 5,
  singleEvent: 6,
  outdoor: 7,
  exam: 8,
  servering: 9,
  fees: 10,
  renewal: 11,
  forms: 12,
  publicRecords: 13,
  serviceHub: 14,
  general: 15,
};

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
  )
    .sort((a, b) => (curatedLinkPriority[a.kind] ?? 999) - (curatedLinkPriority[b.kind] ?? 999))
    .slice(0, 6);

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
    lead: !isWeakEditorialLead(data.editorialLead) ? normalizeText(data.editorialLead || '') : buildLead(data, timeline, curatedLinks, salesNote),
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

  const primaryServing = timeline.find((entry) => entry.kind === 'serving' && /gruppe 1, 2/i.test(entry.label));
  if (primaryServing) {
    const window = formatWindow(primaryServing, ' · ');
    if (window) facts.push(`Øl og vin: ${window}.`);
  }

  const spiritServing = timeline.find((entry) => entry.kind === 'serving' && /gruppe 3/i.test(entry.label));
  if (spiritServing) {
    const window = formatWindow(spiritServing, ' · ');
    if (window) facts.push(`Brennevin: ${window}.`);
  }

  const openingEntry = timeline.find((entry) => entry.kind === 'opening' && /serveringssted/i.test(entry.label))
    || timeline.find((entry) => entry.kind === 'opening');
  if (openingEntry) {
    const window = formatWindow(openingEntry, ' · ');
    if (window) {
      facts.push(`${/ute/i.test(openingEntry.label) ? 'Uteservering' : 'Åpningstid'}: ${window}.`);
    }
  }

  const applicationLink = curatedLinks.find((entry) => entry.kind === 'application');
  if (applicationLink) {
    facts.push('Egen side for søknad og endringer gjør det enklere ved oppstart, eierskifte eller andre endringer i driften.');
  }

  const controlsLink = curatedLinks.find((entry) => entry.kind === 'controls' || entry.kind === 'rules');
  if (!applicationLink && controlsLink) {
    facts.push('Kommunen har også en egen side for regler eller kontroll, så du kan lese hva som faktisk følges opp i driften.');
  }

  const singleEventLink = curatedLinks.find((entry) => entry.kind === 'singleEvent');
  if (!applicationLink && !controlsLink && singleEventLink) {
    facts.push('Kommunen skiller også mellom fast bevilling og enkeltarrangementer, noe som er nyttig hvis du ikke driver helårsservering.');
  }

  if (facts.length < 4 && data.publicRecordsPlatform) {
    facts.push(`Tidligere saker kan spores i ${normalizeText(data.publicRecordsPlatform)}, så du kan sammenligne nettsiden med faktisk praksis.`);
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
    .find((item) => isLateNightCutoff(item.endTime));
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
  const forceKindLabel = kind !== 'general';
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
  const spiritEntry = timeline.find((entry) => entry.kind === 'serving' && /gruppe 3/i.test(entry.label));
  const planLink = curatedLinks.find((entry) => entry.kind === 'plan');
  const applicationLink = curatedLinks.find((entry) => entry.kind === 'application');
  const controlsLink = curatedLinks.find((entry) => entry.kind === 'controls' || entry.kind === 'rules');
  const singleEventLink = curatedLinks.find((entry) => entry.kind === 'singleEvent');
  const parts: string[] = [];

  if (data.editorialTakeaways?.[0]) {
    parts.push(normalizeLeadSentence(data.editorialTakeaways[0]));
  } else if (servingEntry) {
    const window = formatWindow(servingEntry);
    if (window) {
      parts.push(`${data.municipality} oppgir skjenking ${window}.`);
    }
  }

  if (!data.editorialTakeaways?.length && servingEntry && spiritEntry && spiritEntry.endTime && servingEntry.endTime && spiritEntry.endTime !== servingEntry.endTime) {
    parts.push('Brennevin følger en strammere grense enn øl og vin, så nattdrift og intern opplæring må planlegges deretter.');
  }

  if (applicationLink && controlsLink) {
    parts.push('Her finner du både siden for søknad eller endringer og siden som forklarer lokale regler eller kontroll før du åpner.');
  } else if (applicationLink && planLink) {
    parts.push('Her finner du både kilden for lokale tider og siden for søknad eller endringer.');
  } else if (singleEventLink && applicationLink) {
    parts.push('Kommunen skiller også mellom fast drift og arrangementer, så du kan åpne riktig spor med en gang.');
  } else if (applicationLink) {
    parts.push('Her finner du siden for søknad og endringer når du skal åpne, overta eller justere driften.');
  } else if (controlsLink) {
    parts.push('Her finner du også siden som forklarer lokale regler og kontroll før du setter rutiner.');
  } else if (planLink) {
    parts.push(`Her finner du også ${planLink.displayLabel.toLowerCase()} når du må kontrollere originalkilden.`);
  }

  if (salesNote) {
    parts.push('Salgstid er ikke tydelig oppgitt her og må dobbeltsjekkes før du planlegger butikk- eller utsalgssalg.');
  }

  return uniqueValues(parts).slice(0, 3).join(' ');
}

function classifyLinkKind(url: string, label: string) {
  const source = `${url} ${label}`.toLowerCase();
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\/etablerer-og-kunnskapsprovene\/?$|\/kunnskapsprover?\/?$|\/kunnskapsprovene\/?$/.test(pathname)) return 'exam';
    if (/\/kontroller?-og-regelbrudd\/?$|\/kontroll\/?$|\/kontroll-og-prikktildeling\/?$|\/omsetningsoppgave\/?$/.test(pathname)) return 'controls';
    if (/\/skjenkebevilling.*enkelt.*arrangement\/?$|\/enkeltarrangement\/?$|\/enkelt-anledning\/?$|\/arrangement\/?$/.test(pathname)) return 'singleEvent';
    if (/\/uteservering\/?$|\/uteserveringsordning\/?$/.test(pathname)) return 'outdoor';
    if (/\/salgsbevilling(\/|$)/.test(pathname)) return 'sales';
    if (/\/skjenkebevilling/.test(pathname)) return 'serving';
    if (/\/serveringsbevilling/.test(pathname)) return 'servering';
    if (/\/alkohol-servering-og-tobakk\/?$/.test(pathname)) return 'serviceHub';
    if (/\/soke-om-bevillinger\/?$|\/soke-om-eller-endre-bevillinger\/?$|\/søke-om-bevillinger\/?$|\/søke-om-eller-endre-bevillinger\/?$/.test(pathname)) return 'application';
    if (/\/regelverk-for-salgs-og-skjenkesteder\/?$|\/regler-for-salg-og-skjenking\/?$/.test(pathname)) return 'rules';
  } catch {
    // fall through to source-string matching
  }
  if (/handlingsplan|alkoholpolitisk/.test(source)) return 'plan';
  if (/skjenketider|retningslinje/.test(source)) return 'rules';
  if (/enkelt.?anledning|enkeltarrangement|arrangement/.test(source)) return 'singleEvent';
  if (/kontroll|regelbrudd|prikktildeling|omsetningsoppgave/.test(source)) return 'controls';
  if (/prove|prøve|kunnskap|etablerer/.test(source)) return 'exam';
  if (/uteserver|offentlig-areal/.test(source)) return 'outdoor';
  if (/soke-bevilling|søke-bevilling|gjore-endringer|gjøre-endringer/.test(source)) return 'application';
  if (/regler-for|lokale-regler|skjenketider/.test(source)) return 'rules';
  if (/salg-servering-og-skjenking|alkohol-og-servering/.test(source)) return 'serviceHub';
  if (/skjema|ekstern\/veiledere|\/skjema/.test(source)) return 'forms';
  if (/innsyn|journal|einnsyn/.test(source)) return 'publicRecords';
  if (/gebyr|satser/.test(source)) return 'fees';
  if (/fornyelse|fornye/.test(source)) return 'renewal';
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
  const operatingProfile = deriveOperatingProfile(timeline, curatedLinks);
  if (operatingProfile) {
    rows.push({ label: 'Driftsprofil', value: operatingProfile });
  }
  const primaryServing = timeline.find((entry) => entry.kind === 'serving' && /gruppe 1, 2/i.test(entry.label))
    || timeline.find((entry) => entry.kind === 'serving' && entry.startTime && entry.endTime);
  const spiritServing = timeline.find((entry) => entry.kind === 'serving' && /gruppe 3/i.test(entry.label));
  const openingEntry = timeline.find((entry) => entry.kind === 'opening' && /serveringssted/i.test(entry.label))
    || timeline.find((entry) => entry.kind === 'opening');
  const outdoorEntry = timeline.find((entry) => entry.kind === 'opening' && /ute/i.test(entry.label));
  if (primaryServing) {
    rows.push({ label: mapSummaryLabel(primaryServing.label), value: formatWindow(primaryServing, ' · ') || normalizeText(primaryServing.note) });
  }
  if (spiritServing) {
    rows.push({ label: mapSummaryLabel(spiritServing.label), value: formatWindow(spiritServing, ' · ') || normalizeText(spiritServing.note) });
  }
  if (openingEntry) {
    rows.push({ label: /ute/i.test(openingEntry.label) ? 'Uteservering' : 'Åpningstid', value: formatWindow(openingEntry, ' · ') || normalizeText(openingEntry.note) });
  }
  if (outdoorEntry && outdoorEntry !== openingEntry) {
    rows.push({ label: 'Uteservering', value: formatWindow(outdoorEntry, ' · ') || normalizeText(outdoorEntry.note) });
  }
  const applicationLink = curatedLinks.find((entry) => entry.kind === 'application') || curatedLinks.find((entry) => entry.kind === 'forms');
  if (applicationLink) {
    rows.push({ label: 'Søknad', value: applicationLink.kind === 'application' ? 'Egen side for søknad og endringer' : applicationLink.displayLabel });
  }
  const controlsLink = curatedLinks.find((entry) => entry.kind === 'controls' || entry.kind === 'rules');
  if (controlsLink) {
    rows.push({ label: controlsLink.kind === 'controls' ? 'Kontroll' : 'Regelverk', value: controlsLink.displayLabel });
  }
  if (data.publicRecordsPlatform) {
    rows.push({ label: 'Innsyn', value: normalizeText(data.publicRecordsPlatform) });
  }
  if (salesNote) {
    rows.push({ label: 'Salgstid', value: 'Ikke tydelig oppgitt' });
  }
  return uniqueByKey(rows, (entry) => `${entry.label}|${entry.value}`).slice(0, 6);
}

function mapSummaryLabel(label: string) {
  if (/gruppe 1, 2/i.test(label)) return 'Øl og vin';
  if (/gruppe 3/i.test(label)) return 'Brennevin';
  return capitalize(label);
}

function deriveOperatingProfile(
  timeline: MunicipalityTimelineEntry[],
  curatedLinks: Array<LinkEntry & { kind: string; displayLabel: string; displayNote: string }>,
) {
  const descriptors: string[] = [];
  const wineBeer = timeline.find((entry) => entry.kind === 'serving' && /gruppe 1, 2/i.test(entry.label));
  const spirits = timeline.find((entry) => entry.kind === 'serving' && /gruppe 3/i.test(entry.label));
  const opening = timeline.find((entry) => entry.kind === 'opening' && /serveringssted/i.test(entry.label))
    || timeline.find((entry) => entry.kind === 'opening');
  const outdoor = timeline.find((entry) => /ute/i.test(entry.label) || /ute/i.test(entry.note));

  if (opening && isLateNightCutoff(opening.endTime)) {
    descriptors.push('Sen nattdrift');
  } else if (opening && toTimeMinutes(opening.endTime) > -1 && toTimeMinutes(opening.endTime) <= toTimeMinutes('02:00')) {
    descriptors.push('Tidligere stenging');
  }

  if (wineBeer && spirits && wineBeer.endTime && spirits.endTime && wineBeer.endTime !== spirits.endTime) {
    descriptors.push('Strammere spritgrense');
  }

  if (outdoor) {
    descriptors.push('Skiller ute og inne');
  }

  if (curatedLinks.some((entry) => entry.kind === 'singleEvent')) {
    descriptors.push('Har arrangementsløp');
  }

  if (curatedLinks.some((entry) => entry.kind === 'controls')) {
    descriptors.push('Egen kontrollside');
  }

  return uniqueValues(descriptors).slice(0, 2).join(' · ');
}

function normalizeLeadSentence(value: string) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.endsWith('.') ? text : `${text}.`;
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
  const salesLink = curatedLinks.find((entry) => entry.kind === 'sales')
    || curatedLinks.find((entry) => entry.kind === 'rules')
    || curatedLinks.find((entry) => entry.kind === 'serviceHub');
  if (!salesLink) return '';
  return `Vi fant ikke en tydelig salgstid i kildene vi har kontrollert. Åpne ${salesLink.displayLabel.toLowerCase()} før du fastsetter lokale salgstider.`;
}

function isWeakEditorialLead(value?: string) {
  const text = normalizeText(value || '');
  if (!text) return true;
  return /^her ser du hva /i.test(text) || /kommunale sider du faktisk trenger/i.test(text);
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

function isLateNightCutoff(value: string) {
  const normalized = normalizeTime(value);
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  return hour >= 0 && hour <= 6;
}

function capitalize(value: string) {
  const normalized = normalizeText(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
