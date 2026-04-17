# Municipality Image Prompts

These prompts are the reusable source of truth for municipality hero-image generation.

Rules:

- no text inside the image
- no logos, watermarks, or signage
- no fake forms or permit graphics
- editorial, trustworthy, municipality-specific atmosphere
- enough visual quiet space for the page headline

Current prompt-backed flagship heroes:

- `arendal`
- `bergen`
- `bjerkreim`
- `bremanger`
- `farsund`
- `halden`
- `lillehammer`
- `narvik`
- `nord-aurdal`
- `trysil`

Render command pattern:

```powershell
python C:\Users\heial\.codex\skills\nano-banana-image\scripts\render_gemini_image.py --prompt-file docs\municipality-image-prompts\arendal.txt --model gemini-3-pro-image-preview --aspect-ratio 16:9 --image-size 1K --out-dir output\municipality-images\arendal
```

After rendering, copy the chosen file into:

`apps/blog/public/images/kommune/<slug>-hero.png`

The municipality generator will attach the image automatically when that file exists.
