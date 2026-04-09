# Checklist

## Minimum Release Standard

1. `pnpm verify`
2. `pnpm qa`
3. verify mounted HTML returns `200`
4. verify mounted CSS asset returns `text/css`
5. verify guide `rss.xml` and `sitemap.xml`
6. verify apex `robots.txt`, `sitemap.xml`, and `sitemap-index.xml` if those routes are owned by this repo

## If Any Gate Fails

- fix the repo
- rerun the gates
- do not waive the failure because the page “looks okay”
