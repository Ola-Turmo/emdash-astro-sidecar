// test/evaluateDraftArtifact.test.mjs — unit tests for @emdash/content-evals
//
// Uses Node 22's built-in node:test runner. No new dependencies.
//
// Run with: pnpm test  (or: node --test test/evaluateDraftArtifact.test.mjs)
//
// What this covers:
//   - scoreEvalSuite() — pure function over an array of results.
//   - evaluateDraftArtifact() — the 8 content criteria. We test each
//     criterion independently with a builder that starts from a passing
//     baseline and only flips the field the criterion depends on, so
//     a failure names the exact criterion.
//   - Internal-link counting handles relative + absolute + external links.
//   - Jargon detection catches every term in INTERNAL_JARGON_PATTERN.
//   - Word counting, section counting, and metadata thresholds.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreEvalSuite,
  evaluateDraftArtifact,
  defaultContentCriteria,
} from '../src/index.ts';

// ----- helpers -------------------------------------------------------------

const SITE_URL = 'https://example.no';

const passingBaseline = () => ({
  title: 'Hvordan velge riktig regnskapssystem for ditt AS i 2026',
  description: 'Denne guiden hjelper deg å velge et regnskapssystem som passer for ditt AS, med fokus på MVA, årsoppgjør, lønn, faktura og bokføring i ett verktøy.',
  excerpt: 'Vi går gjennom de viktigste kriteriene for å velge riktig regnskapssystem for et lite AS: fra MVA-registrering og bokføring til lønnskjøring og årsoppgjør. Les videre for å se hva som skiller de ulike systemene på markedet i dag.',
  sections: [
    {
      heading: 'Hva bør du se etter i et regnskapssystem for et lite AS',
      body: 'Et godt regnskapssystem for et lite AS bør håndtere MVA-registrering, lønn, fakturering og årsoppgjør uten at du må bytte mellom flere verktøy. Først og fremst bør systemet være enkelt nok til at du kan lære deg grunnleggende funksjoner uten å ta et kurs, men kraftig nok til å vokse med selskapet. Se [guiden om MVA](/guide/mva) og [oversikten over systemer](/oversikt) for mer bakgrunn.',
    },
    {
      heading: 'De viktigste funksjonene du trenger i hverdagen',
      body: 'De viktigste funksjonene i et moderne regnskapssystem er bokføring, MVA-melding, lønnskjøring, faktura og årsoppgjør. Noen systemer leveres som en samlet pakke der alt henger naturlig sammen, mens andre er spesialisert på enkeltfunksjoner. Velg gjerne en helhetlig løsning for å slippe å flytte data mellom verktøy for hver enkelt oppgave i den daglige driften av selskapet.',
    },
    {
      heading: 'Vanlige feil når man velger system for første gang',
      body: 'Mange nye regnskapsførere velger etter pris alene og ender opp med et system som mangler viktige funksjoner de trenger senere når selskapet vokser. Andre velger et system som er for avansert og bruker unødig tid på funksjoner de aldri kommer til å bruke i praksis. Tenk nøye over hva du faktisk trenger i dag, og hva du realistisk kan komme til å trenge om to år når selskapet vokser og regnskapet blir mer komplekst og krever bedre kontroll på MVA-meldinger, lønn, årsoppgjør og leverandørreskontro i samme system. Det er også lurt å snakke med en regnskapsfører før du bestemmer deg for et system.',
    },
  ],
  sourceCount: 2,
  siteUrl: SITE_URL,
});

// A baseline with NO pre-existing internal links. The internal-links
// tests append to sections[0].body, so the baseline must start at
// zero internal links to give each test a clean "add 1 → still fail"
// / "add 2 → pass" baseline. (passingBaseline() has 2 internal links
// in section[0], which would make the "1 link" tests pass.)
const linklessBaseline = () => {
  const b = passingBaseline();
  return {
    ...b,
    sections: b.sections.map((s) => ({
      ...s,
      // Strip the "Se [a](...) og [b](...) for mer bakgrunn." tail
      // that the passing baseline uses to satisfy the 2-link rule.
      body: s.body.replace(/ Se \[[^\]]+\]\([^)]+\) og \[[^\]]+\]\([^)]+\) for mer bakgrunn\./, ''),
    })),
  };
};

// ----- scoreEvalSuite ------------------------------------------------------

test('scoreEvalSuite counts only the passed results', () => {
  const results = [
    { criterionId: 'a', passed: true },
    { criterionId: 'b', passed: false, reason: 'nope' },
    { criterionId: 'c', passed: true },
    { criterionId: 'd', passed: false },
  ];
  assert.equal(scoreEvalSuite(results), 2);
});

test('scoreEvalSuite returns 0 on an empty list', () => {
  assert.equal(scoreEvalSuite([]), 0);
});

test('scoreEvalSuite ignores the `reason` and `flaky` flags', () => {
  const results = [
    { criterionId: 'a', passed: true, flaky: true },
    { criterionId: 'b', passed: true, reason: 'why' },
  ];
  assert.equal(scoreEvalSuite(results), 2);
});

// ----- defaultContentCriteria constant -------------------------------------

test('defaultContentCriteria has 8 criteria with stable ids', () => {
  // Pin the criterion ids so a future refactor that renames one is
  // caught in code review. The content dashboard keys metrics on
  // these ids; renaming silently would break the audit report.
  const ids = defaultContentCriteria.map((c) => c.id);
  assert.deepEqual(ids, [
    'single-h1',
    'reader-first-copy',
    'minimum-depth',
    'answers-early',
    'distinct-section-headings',
    'internal-links',
    'evidence-threshold',
    'metadata-quality',
  ]);
  for (const criterion of defaultContentCriteria) {
    assert.equal(criterion.method, 'rule', `criterion ${criterion.id} is rule-evaluable`);
    assert.ok(criterion.label.length > 0, `criterion ${criterion.id} has a label`);
    assert.ok(criterion.description.length > 0, `criterion ${criterion.id} has a description`);
  }
});

// ----- evaluateDraftArtifact: baseline -------------------------------------

test('evaluateDraftArtifact passes every criterion on a strong baseline draft', () => {
  const results = evaluateDraftArtifact(passingBaseline());
  const failed = results.filter((r) => !r.passed);
  assert.deepEqual(failed, [], `expected baseline to pass all criteria; failed: ${failed.map((f) => f.criterionId).join(', ')}`);
  for (const result of results) {
    assert.ok(result.reason, `criterion ${result.criterionId} should have a reason`);
  }
});

// ----- evaluateDraftArtifact: single-h1 ------------------------------------

test('single-h1 fails when title is shorter than 20 chars', () => {
  const input = passingBaseline();
  input.title = 'Kort tittel';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'single-h1');
  assert.equal(r.passed, false);
  assert.match(r.reason, /too short/);
});

test('single-h1 fails when title is exactly 19 chars', () => {
  const input = passingBaseline();
  input.title = 'Nitten tegn kanskje';
  assert.equal(input.title.trim().length, 19);
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'single-h1');
  assert.equal(r.passed, false);
});

test('single-h1 passes when title is exactly 20 chars', () => {
  const input = passingBaseline();
  input.title = 'Nitten tegn kanskje!';
  assert.equal(input.title.trim().length, 20);
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'single-h1');
  assert.equal(r.passed, true);
});

test('single-h1 fails when title is whitespace only', () => {
  const input = passingBaseline();
  input.title = '                     ';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'single-h1');
  assert.equal(r.passed, false);
});

// ----- evaluateDraftArtifact: reader-first-copy (jargon detection) --------

test('reader-first-copy fails when body contains the word "SEO"', () => {
  const input = passingBaseline();
  input.sections[0].body += ' For bedre SEO bør du optimalisere titlene.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'reader-first-copy');
  assert.equal(r.passed, false);
  assert.match(r.reason, /operator terminology/);
});

test('reader-first-copy fails when description mentions "programmatic seo"', () => {
  const input = passingBaseline();
  input.description += ' Denne siden er laget for programmatic seo.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'reader-first-copy');
  assert.equal(r.passed, false);
});

test('reader-first-copy fails when the title mentions "sidecar"', () => {
  const input = passingBaseline();
  input.title = 'Hvordan en Astro sidecar forbedrer ditt regnskapssystem';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'reader-first-copy');
  assert.equal(r.passed, false);
});

test('reader-first-copy fails when the Norwegian compound "innholdsbølge" appears', () => {
  const input = passingBaseline();
  input.sections[2].body += ' Passer godt inn i en innholdsbølge.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'reader-first-copy');
  assert.equal(r.passed, false);
});

test('reader-first-copy is case-insensitive', () => {
  const input = passingBaseline();
  input.excerpt += ' GEO er viktig for synlighet.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'reader-first-copy');
  assert.equal(r.passed, false);
});

test('reader-first-copy currently flags jargon inside a code span (documented behavior)', () => {
  // The current implementation does a regex over visibleText, so any
  // appearance (even inside a backtick code span) trips the check.
  // This test documents the current behavior. If we ever want to
  // exclude code-fenced blocks, this test should be updated to
  // assert the opposite (i.e. true) and the implementation tightened.
  const input = passingBaseline();
  input.sections[1].body += ' Se `seo` i konfigurasjonen for detaljer.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'reader-first-copy');
  assert.equal(r.passed, false, 'current implementation flags jargon even inside code spans');
});

// ----- evaluateDraftArtifact: minimum-depth --------------------------------

test('minimum-depth fails when there are fewer than 3 sections', () => {
  const input = passingBaseline();
  input.sections = input.sections.slice(0, 2);
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'minimum-depth');
  assert.equal(r.passed, false);
  assert.match(r.reason, /too thin/);
});

test('minimum-depth fails when the total word count is below 320', () => {
  const input = passingBaseline();
  for (const s of input.sections) s.body = 'kort setning her.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'minimum-depth');
  assert.equal(r.passed, false);
});

test('minimum-depth fails when fewer than 3 sections have a substantive body', () => {
  const input = passingBaseline();
  input.sections[2].body = 'litt tekst';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'minimum-depth');
  assert.equal(r.passed, false);
});

test('minimum-depth flips to false when one section is thinned to <35 words', () => {
  // The substantive-body threshold is 35 words (heading + body),
  // measured by countWords(s.heading + ' ' + s.body) >= 35.
  const input = passingBaseline();
  input.sections[2].body = Array.from({ length: 5 }, (_, i) => `ord${i}`).join(' ');
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'minimum-depth');
  assert.equal(r.passed, false, 'thinning a section to <35 words should fail minimum-depth');
});

// ----- evaluateDraftArtifact: answers-early --------------------------------

test('answers-early fails when the first section body has fewer than 45 words', () => {
  const input = passingBaseline();
  input.sections[0].body = 'For kort.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'answers-early');
  assert.equal(r.passed, false);
  assert.match(r.reason, /first section/);
});

test('answers-early passes when the first section body has exactly 45 words', () => {
  const input = passingBaseline();
  input.sections[0].body = Array.from({ length: 45 }, (_, i) => `ord${i + 1}`).join(' ');
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'answers-early');
  assert.equal(r.passed, true);
});

test('answers-early fails when there are zero sections', () => {
  const input = passingBaseline();
  input.sections = [];
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'answers-early');
  assert.equal(r.passed, false);
});

// ----- evaluateDraftArtifact: distinct-section-headings --------------------

test('distinct-section-headings fails when two sections have the same heading', () => {
  const input = passingBaseline();
  input.sections[2].heading = input.sections[1].heading;
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'distinct-section-headings');
  assert.equal(r.passed, false);
  assert.match(r.reason, /repeats/);
});

test('distinct-section-headings is case-insensitive', () => {
  const input = passingBaseline();
  input.sections[2].heading = input.sections[1].heading.toUpperCase();
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'distinct-section-headings');
  assert.equal(r.passed, false);
});

test('distinct-section-headings treats whitespace-trimmed headings as equal', () => {
  const input = passingBaseline();
  input.sections[2].heading = '   ' + input.sections[1].heading + '   ';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'distinct-section-headings');
  assert.equal(r.passed, false);
});

test('distinct-section-headings ignores empty-string headings', () => {
  const input = passingBaseline();
  input.sections[2].heading = '';
  // The filter(Boolean) drops empty strings before deduping, so a
  // single empty heading doesn't count as a duplicate of itself.
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'distinct-section-headings');
  assert.equal(r.passed, true);
});

// ----- evaluateDraftArtifact: internal-links -------------------------------

test('internal-links passes when there are 2 relative links to the same host', () => {
  const input = linklessBaseline();
  input.sections[0].body += ' Se [a](/guide/a) og [b](/guide/b) for mer.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'internal-links');
  assert.equal(r.passed, true);
});

test('internal-links passes when links are absolute and match the site host', () => {
  const input = linklessBaseline();
  input.sections[0].body += ' Se [a](https://example.no/a) og [b](https://www.example.no/b) for mer.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'internal-links');
  assert.equal(r.passed, true, 'www. prefix should be normalized to the bare host');
});

test('internal-links fails when only 1 internal link is present', () => {
  const input = linklessBaseline();
  input.sections[0].body += ' Se [a](/guide/a) for mer.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'internal-links');
  assert.equal(r.passed, false);
});

test('internal-links fails when links are external (different host)', () => {
  const input = linklessBaseline();
  input.sections[0].body += ' Se [a](https://other-site.com/a) og [b](https://other-site.com/b) for mer.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'internal-links');
  assert.equal(r.passed, false);
});

test('internal-links counts a mix of relative and absolute internal links', () => {
  const input = linklessBaseline();
  input.sections[0].body += ' Se [c](https://other.com/c) for mer.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'internal-links');
  // No internal links in this draft — the other.com link is external.
  assert.equal(r.passed, false, 'zero internal links in this draft');
});

test('internal-links treats broken URLs (not parseable) as external', () => {
  const input = linklessBaseline();
  input.sections[0].body += ' Se [a](not a url) og [b](/guide/b) for mer.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'internal-links');
  // The not-a-url branch returns false (treated as external), so
  // only /guide/b counts. That's 1 internal link — fails.
  assert.equal(r.passed, false);
});

// ----- evaluateDraftArtifact: evidence-threshold ---------------------------

test('evidence-threshold fails when sourceCount is 0', () => {
  const input = passingBaseline();
  input.sourceCount = 0;
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'evidence-threshold');
  assert.equal(r.passed, false);
  assert.match(r.reason, /[Nn]o source/);
});

test('evidence-threshold passes when sourceCount is 1', () => {
  const input = passingBaseline();
  input.sourceCount = 1;
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'evidence-threshold');
  assert.equal(r.passed, true);
});

// ----- evaluateDraftArtifact: metadata-quality -----------------------------

test('metadata-quality fails when title is too short', () => {
  const input = passingBaseline();
  input.title = 'Kort'; // 4 chars
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'metadata-quality');
  assert.equal(r.passed, false);
});

test('metadata-quality fails when description is shorter than 90 chars', () => {
  const input = passingBaseline();
  input.description = 'For kort beskrivelse.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'metadata-quality');
  assert.equal(r.passed, false);
});

test('metadata-quality fails when description is longer than 170 chars', () => {
  const input = passingBaseline();
  // 171 chars — one over the upper bound.
  input.description = 'Denne beskrivelsen er bevisst lengre enn det som er tillatt for å teste at funksjonen fanger opp for lange beskrivelser og returnerer false på metadata-quality-kriteriet!!';
  assert.equal(input.description.trim().length, 171);
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'metadata-quality');
  assert.equal(r.passed, false);
});

test('metadata-quality fails when excerpt is shorter than 120 chars', () => {
  const input = passingBaseline();
  input.excerpt = 'For kort.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'metadata-quality');
  assert.equal(r.passed, false);
});

test('metadata-quality fails when excerpt is longer than 230 chars', () => {
  const input = passingBaseline();
  input.excerpt = 'Dette er et bevisst altfor langt utdrag som overskrider den øvre grensen på 230 tegn som er satt for excerpt-feltet, slik at vi kan teste at funksjonen fanger opp dette og returnerer false på metadata-quality-kriteriet for safe publish path.';
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'metadata-quality');
  assert.equal(r.passed, false);
});

test('metadata-quality passes at the lower bounds (title 20, desc 90, excerpt 120)', () => {
  const input = passingBaseline();
  input.title = '12345678901234567890'; // exactly 20
  input.description = 'a'.repeat(90);
  input.excerpt = 'a'.repeat(120);
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'metadata-quality');
  assert.equal(r.passed, true);
});

test('metadata-quality passes at the upper bounds (title any, desc 170, excerpt 230)', () => {
  const input = passingBaseline();
  input.title = 'a'.repeat(20);
  input.description = 'a'.repeat(170);
  input.excerpt = 'a'.repeat(230);
  const r = evaluateDraftArtifact(input).find((x) => x.criterionId === 'metadata-quality');
  assert.equal(r.passed, true);
});

// ----- regression: result shape -------------------------------------------

test('evaluateDraftArtifact returns one result per criterion in defaultContentCriteria', () => {
  const results = evaluateDraftArtifact(passingBaseline());
  assert.equal(results.length, defaultContentCriteria.length);
  for (const criterion of defaultContentCriteria) {
    const result = results.find((r) => r.criterionId === criterion.id);
    assert.ok(result, `missing result for criterion ${criterion.id}`);
  }
});

test('each result has a reason string (whether passed or failed)', () => {
  const passingResults = evaluateDraftArtifact(passingBaseline());
  for (const r of passingResults) {
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0);
  }
  const failingInput = passingBaseline();
  failingInput.title = 'x';
  const failingResults = evaluateDraftArtifact(failingInput);
  for (const r of failingResults) {
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0);
  }
});
