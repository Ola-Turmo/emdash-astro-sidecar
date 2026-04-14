# Accessibility Review Checklist

Use this on flagship pages and landing pages in addition to `pnpm qa:accessibility`.

## Keyboard

- Tab order is logical from header to main content to footer.
- All visible actions can be reached with keyboard only.
- Focus rings are visible on links, buttons, and form controls.
- No keyboard trap appears in sticky headers, drawers, or dialogs.

## Reading And Structure

- Page has one clear `h1`.
- Heading levels descend logically.
- Link text makes sense out of context.
- Lists, cards, and timelines still read sensibly in screen-reader order.

## Images And Media

- Content images have meaningful `alt`.
- Decorative images have empty `alt=""`.
- No critical information exists only inside an image.
- Video/audio, if added later, includes captions or transcript paths.

## Contrast And Zoom

- Small body copy remains readable on mobile and desktop.
- Footer/meta copy still clears WCAG AA contrast.
- Page remains usable at 200% zoom.
- Mobile landscape and narrow-width layouts do not clip important controls.

## Forms And Inputs

- Inputs have visible labels or equivalent programmatic names.
- Error states are readable and not color-only.
- Primary CTA buttons remain clearly named and obvious in context.

## Content-Specific Checks

- `guide` pages keep article content readable with sufficient spacing and heading contrast.
- `kommune` pages keep local fact cards readable and do not hide key rules in low-contrast sidebars.
- Timelines and summary cards remain understandable without hover or pointer-only interaction.
