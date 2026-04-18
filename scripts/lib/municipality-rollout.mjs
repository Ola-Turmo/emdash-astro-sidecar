import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { normalizeText } from './municipality-evidence.mjs';

export async function loadMunicipalityCatalog(repoRoot) {
  const sourceRepo = path.join(path.dirname(repoRoot), 'kommune.no.apimcp.site');
  const sourceCatalogPath = path.join(sourceRepo, 'kommune_catalog.enriched.json');
  const raw = await readFile(sourceCatalogPath, 'utf8');
  const catalog = JSON.parse(raw);
  return {
    sourceRepo,
    sourceCatalogPath,
    catalog,
  };
}

export function normalizeMunicipalityName(value) {
  return normalizeText(value || '');
}

export function selectMunicipalityBatch({
  catalog,
  existingEntries,
  batchSize,
  excludeMunicipalities = new Set(),
}) {
  const existingByMunicipality = new Map(
    existingEntries.map((entry) => [normalizeMunicipalityName(entry.municipality), entry]),
  );

  const candidates = catalog
    .map((row) => {
      const municipality = normalizeMunicipalityName(row.Kommunenavn);
      if (excludeMunicipalities.has(municipality)) {
        return null;
      }
      const existing = existingByMunicipality.get(municipality);
      if (existing && !existing.draft) {
        return null;
      }

      return {
        municipality,
        existing,
        sourceScore: scoreMunicipalitySource(row),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.sourceScore !== a.sourceScore) return b.sourceScore - a.sourceScore;
      if (!a.existing && b.existing) return -1;
      if (a.existing && !b.existing) return 1;
      return a.municipality.localeCompare(b.municipality, 'nb');
    });

  return candidates.slice(0, Math.max(1, Math.min(10, batchSize))).map((candidate) => candidate.municipality);
}

export function scoreMunicipalitySource(row) {
  const serviceUrls = (row.alcohol_restaurant_urls || []).length;
  const regulationUrls = (row.forskrifter_urls || []).length;
  const bylawUrls = (row.vedtekter_urls || []).length;
  const openingRules = row.opening_hours_rules || [];
  const servingRules = row.alcohol_serving_hours_rules || [];
  const structuredServingRules = servingRules.filter((rule) => rule.end_time).length;
  const explicitServingNotes = servingRules.filter((rule) =>
    /\b\d{1,2}[:.]\d{2}\b|midnatt|30 minutter|halv time/iu.test(String(rule.note || '')),
  ).length;
  const openingHints = openingRules.filter((rule) =>
    /\b\d{1,2}[:.]\d{2}\b|skjenkeslutt|midnatt|30 minutter|halv time/iu.test(String(rule.note || '')),
  ).length;

  return (
    Math.min(serviceUrls, 6) * 2 +
    Math.min(regulationUrls, 2) +
    Math.min(bylawUrls, 1) +
    (row.forms_url ? 3 : 0) +
    (row.innsyn_url ? 3 : 0) +
    (row.alcohol_policy_plan_url ? 3 : 0) +
    Math.min(structuredServingRules, 2) * 3 +
    Math.min(explicitServingNotes, 2) * 2 +
    Math.min(openingHints, 2) * 2
  );
}
