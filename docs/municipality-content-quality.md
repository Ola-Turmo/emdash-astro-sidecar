# Municipality Content Quality

This document turns the `kurs.ing/kommune` lessons into reusable rollout rules for future local-content concepts.

## Core Rule

A municipality page is not a blog post with a few local links added.

It is a local decision-support page built from:

- verified municipality links
- municipality-specific time rules
- municipality-specific process differences
- a clear split between confirmed facts and "check this source" guidance

If those elements are missing, the page should not ship.

## What A Good Municipality Page Must Do

Every municipality page should:

- show real local alcohol times when the source data actually contains them
- distinguish between:
  - skjenking
  - opening time
  - uncertain sale-time information
- surface practical local differences:
  - application flow
  - controls or inspections
  - fees or renewal when present
  - uteservering or single-event rules when present
- link only to working, municipality-relevant pages
- link onward to the main guide/course system only after the local page has done its local job

## What Must Never Happen Again

The system must not publish municipality pages that:

- repeat the same generic prose across municipalities
- present a weak source hint as if it were a confirmed local fact
- show duplicate cards with different URLs but the same weak label
- link to unrelated municipal material such as school, graveyard, or random regulation pages
- use placeholder labels like `Relevant kommuneside 2`, `Forskrift 1`, or `Vedtekt 1`
- summarize a municipality using generic home-page text with no alcohol or permit relevance
- stay live when the municipality data is too weak to support a trustworthy local page

## Drop Weak Municipalities

If the municipality source quality is weak, the correct outcome is to draft or drop the page.

Do not publish a municipality page just because the system found:

- one or two links
- a generic front-page summary
- contact or supplier metadata
- a weak source title with no real local insight

For `/kommune`, weak data should fail closed.

That means the page should stay out of the published set until it has:

- enough confirmed local time rules
- a clear plan or local alcohol-policy source
- a real application path
- a real innsyn path
- at least one useful local source summary or takeaway

## Content Model Rules

For local-content concepts like `/kommune`, prioritize structured facts over long prose.

Good blocks:

- fact cards
- local timeline cards
- curated municipal links
- short local-difference summaries
- checklist blocks
- selected official-source cards

Weak blocks:

- long repeated intros
- generic municipal home-page summaries
- filler explanation paragraphs that do not change from municipality to municipality

## Timeline Rules

Use the local timeline only for facts supported by the municipality source set.

Allowed in the timeline:

- confirmed skjenketider
- confirmed opening-time rules
- seasonal or special-period opening exceptions when they are explicit

Do not put uncertain sale-time guidance in the timeline.

If sale time is not explicit in the source set:

- render a separate warning/check block
- clearly say the user must verify sale time on the municipal source page

## Link Curation Rules

Each municipality page should prefer a compact set of high-value municipal links.

Best link types:

- alcoholpolitisk plan / skjenketider
- main permit hub for sale/servering/skjenking
- application / change flow
- rules / local conditions
- forms / self-service
- public records / innsyn
- controls / fees / renewal / uteservering / single-event pages when available

Avoid bloated link grids. More cards does not mean more value.

## Source Summary Rules

Do not trust every title or description from a municipal page.

Ignore or down-rank summaries that look like:

- generic municipality front-page copy
- accessibility helper text
- contact boilerplate
- voice-assistant helper text
- generic "find services and information" copy

Prefer summaries that mention:

- bevilling
- skjenking
- salg
- servering
- kontroll
- gebyr
- arrangement
- prøver

## Design Rules For Local Concepts

Local-content concepts should use the same brand shell as the main site, but the information structure must be different from the guide/blog concept.

For `/kommune`, this means:

- fewer decorative paragraphs
- more factual blocks
- stronger scanning
- obvious local-rule hierarchy
- clear visual separation between:
  - facts
  - links
  - official sources
  - next step

## Image Rules

Municipality pages may use images, but only when the image strengthens trust and place without carrying factual claims by itself.

Allowed:

- municipality-specific hero images with a calm editorial look
- coastal, urban, inland, or fjord context that fits the municipality
- visual negative space that works with the page layout

Not allowed:

- text inside the image
- maps or infographic overlays
- fake documents, permits, or forms
- generic business-stock imagery
- images used to hide weak or repetitive local content

The image is supporting context. The page still has to stand on local facts, useful links, and municipality-specific interpretation.

## Norwegian Writing Rules

The language on municipality pages should read like local guidance, not like AI-generated content operations.

Good direction:

- short lead paragraphs that explain what the reader gets on the page
- clear wording around what is confirmed and what still must be checked
- labels that name the action or source plainly
- interpretation that helps the reader decide what to open first

Bad direction:

- synthetic phrases like `forklart med faktiske lokale tider`
- generic wording like `kommunale lenker`
- system-language like `det strukturerte datagrunnlaget`
- detective-language like `de viktigste sporene du må sjekke`
- meta phrasing like `praktiske innganger`

If a sentence sounds like internal prompt output instead of a municipal guide written for a Norwegian reader, rewrite it before shipping.

## Required Gates

Before publishing municipality content, the repo should at minimum pass:

- `pnpm qa:municipality`
- `pnpm report:municipality`
- concept build for `kurs-ing/kommune`
- live smoke checks on representative municipality URLs

The report should be treated as the operator summary for the current municipality set:

- which municipalities are still publishable
- which municipalities were drafted out
- why weak municipalities were removed from the public set

Future local concepts should add their own concept-specific content gates instead of reusing blog assumptions.

## Reusable Principle For Future Projects

This applies beyond municipalities.

Any local, regional, vertical, or regulated-content concept should be treated as:

- structured decision support

not:

- generic SEO article generation

If the page is supposed to help someone act in a specific jurisdiction or process, the system should default to:

- verified local facts
- explicit uncertainty handling
- curated source links
- short, non-repetitive interpretation

That is the standard for future multi-site and multi-concept rollouts.
