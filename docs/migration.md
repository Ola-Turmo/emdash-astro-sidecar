# Migration Guide

## Overview

EmDash Astro Sidecar is designed to integrate seamlessly into existing websites regardless of your tech stack. This guide covers integration patterns for each major platform, shared component strategies, and configuration details for fonts, colors, and analytics.

The blog deploys as a standalone Astro application that can be mounted at any path (default: `/blog`) or subdomain. It shares design tokens with the host site to maintain visual consistency while keeping complete code isolation.

## Integration Patterns

### Next.js Host Site

Next.js provides multiple strategies for integrating the Astro Sidecar blog.

**Deployment Configuration:**
```javascript
// next.config.js
// Option 1: Subpath deployment (recommended for SEO)
// The Astro build outputs to /blog, configure Next.js to serve it

// Option 2: Proxy to separate service
// Use next.config.js rewrites for blog.example.com -> internal-service
```

**Shared Navigation Options:**

Option A — Import Astro components into Next.js:
```tsx
// components/BlogNav.tsx
'use client'
import { useEffect, useState } from 'react'

export function BlogNav() {
  const [navItems, setNavItems] = useState([])
  
  useEffect(() => {
    // Fetch nav config from blog API
    fetch('/blog/api/navigation')
      .then(res => res.json())
      .then(setNavItems)
  }, [])
  
  return (
    <nav className="blog-nav">
      {navItems.map(item => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
```

Option B — Use iframe-resizer for isolated nav:
```html
<!-- In your Next.js layout -->
<iframe 
  src="/blog/navigation.html" 
  class="blog-nav-iframe"
  scrolling="no"
></iframe>
<script src="/blog/iframe-resizer/iframeResizer.contentWindow.min.js"></script>
```

**Shared Fonts:**
```css
/* In Astro blog's CSS */
@import url('https://fonts.googleapis.com/css2?family=YourHostFont:wght@400;600;700&display=swap');

/* Or import from Next.js public assets */
@import url('/fonts/host-site-fonts.css');
```

**Shared Color System:**
```css
/* blog/styles/tokens.css */
@import '/__next/static/css/host-tokens.css';

/* Override only blog-specific semantic tokens */
:root {
  --color-blog-accent: var(--color-primary-600);
  --color-blog-surface: var(--color-gray-50);
}
```

**Analytics (GA4 with path filtering):**
```javascript
// In your Next.js _app.tsx or layout
import { usePathname } from 'next/navigation'

export function Analytics() {
  const pathname = usePathname()
  const isBlogPath = pathname.startsWith('/blog')
  
  useEffect(() => {
    // GA4 already loaded via Next.js
    if (isBlogPath) {
      gtag('set', 'content_group', 'blog')
    }
  }, [pathname])
  
  return null
}
```

---

### Static HTML Host Site

Static sites require manual file management but offer the simplest integration.

**Deployment Steps:**

1. Build the Astro blog:
   ```bash
   npm run build
   ```

2. Copy output to host site:
   ```bash
   cp -r dist/* /var/www/html/blog/
   ```

3. Add navigation link from index:
   ```html
   <!-- In index.html -->
   <nav>
     <a href="/">Home</a>
     <a href="/blog/">Blog</a>
   </nav>
   ```

**CSS Variables Sync:**

Copy host site variables to blog stylesheet or import:
```css
/* In blog/styles/main.css */
@import '/css/host-tokens.css';

/* Blog-specific overrides */
:root {
  --blog-primary: var(--host-primary);
  --blog-secondary: var(--host-secondary);
}
```

**Analytics Setup:**
```html
<!-- In index.html head -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>

<!-- Same snippet in blog/index.html head -->
```

---

### WordPress Host Site

WordPress integration requires careful path and API handling.

**Deployment:**

1. Upload Astro build to `/blog/` subdirectory in WordPress root
2. Ensure WordPress permalinks don't conflict with blog routes
3. Configure WordPress to ignore `/blog/` paths in rewrite rules

**Shared Navigation via REST API:**

```php
<?php
// In your WordPress theme's header.php
function get_blog_nav_items() {
  $response = wp_remote_get(home_url('/blog/api/navigation'));
  if (is_wp_error($response)) return [];
  return json_decode(wp_remote_retrieve_body($response), true);
}
?>
<nav class="shared-nav">
  <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
  <?php 
  $nav_items = get_blog_nav_items();
  foreach ($nav_items as $item): 
  ?>
    <a href="<?php echo esc_url($item['href']); ?>"><?php echo esc_html($item['label']); ?></a>
  <?php endforeach; ?>
</nav>
```

**Alternative: iframe Integration**
```html
<iframe 
  src="<?php echo get_stylesheet_directory_uri(); ?>/blog/navigation.html" 
  id="blog-nav"
  style="border:none; width:100%; height:60px;"
></iframe>
<script src="/blog/iframe-resizer/iframeResizer.contentWindow.min.js"></script>
```

**Theme.json Design Token Sync:**

The Astro blog can export tokens in WordPress theme.json format:
```javascript
// astro.config.mjs
export default defineConfig({
  sidecar: {
    tokenExport: {
      format: 'wordpress-theme-json',
      output: 'wp-content/themes/your-theme/theme.json'
    }
  }
});
```

**Analytics (GA4 via WordPress plugin + blog):**
```php
// WordPress functions.php
// GA4 via plugin (Yoast, etc.) covers main site
// Add blog-specific tracking:

function blog_ga4_tracking() {
  if (is_singular('post')) {
    ?>
    <script>
      gtag('set', 'content_group', 'blog');
      gtag('event', 'blog_read', {
        'blog_post_id': '<?php the_ID(); ?>'
      });
    </script>
    <?php
  }
}
add_action('wp_head', 'blog_ga4_tracking');
```

---

### Laravel Host Site

Laravel's Blade templating and asset pipeline make integration straightforward.

**Deployment:**

```bash
# Build blog
npm run build

# Copy to Laravel public directory
cp -r dist/* /var/www/myapp/public/blog/
```

**Shared Navigation via Blade Components:**

```php
{{-- resources/views/components/shared-nav.blade.php --}}
<nav class="shared-nav">
    <a href="{{ url('/') }}">Home</a>
    <a href="{{ url('/blog') }}">Blog</a>
    @foreach($navItems ?? [] as $item)
        <a href="{{ url($item['href']) }}">{{ $item['label'] }}</a>
    @endforeach
</nav>
```

```html
{{-- In your layout --}}
<x-shared-nav :nav-items="$navigationItems" />
```

**CSS Variables Integration:**

```scss
// resources/sass/blog-tokens.scss
// Import host site variables
@import 'host-tokens';

// Override blog-specific tokens
:root {
  --blog-accent: $primary;
  --blog-surface: $gray-50;
}

// In app.scss
@import 'blog-tokens';
```

**Analytics (GTM Container):**
```html
{{-- In your Blade layout head --}}
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
{{-- End GTM --}}

{{-- Body tag --}}
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

Blog pages automatically inherit GTM. Add path-based triggers in GTM:
```
Trigger: Page Path contains /blog/
Action: Set content group = "blog"
```

---

### Rails Host Site

Rails integration uses the public directory and view helpers.

**Deployment:**

```bash
# Build blog
npm run build

# Copy to Rails public directory
cp -r dist/* /var/www/myapp/public/blog/
```

**Shared Navigation:**

```erb
<%# app/views/layouts/_shared_nav.html.erb %>
<nav class="shared-nav">
  <%= link_to 'Home', root_path %>
  <%= link_to 'Blog', blog_path %>
  <% @nav_items.each do |item| %>
    <%= link_to item[:label], item[:href] %>
  <% end %>
</nav>
```

```erb
<%# In your application layout --%>
<%= render 'layouts/shared_nav', nav_items: @nav_items %>
```

**Sass/Importmap Integration:**

```scss
// app/assets/stylesheets/blog_tokens.scss
// Host site variables
@import 'host_variables';

// Blog-specific overrides
:root {
  --blog-primary: $primary-color;
  --blog-surface: $surface-light;
}
```

```ruby
# config/importmap.rb (Rails 7+)
pin "blog_tokens", to: "blog_tokens.scss"
```

**Analytics (GA4 with hostname filtering):**
```ruby
# app/views/layouts/application.html.erb
<% if request.host.include?('blog') %>
  <% content_for :ga4_extra do %>
    gtag('set', 'content_group', 'blog');
  <% end %>
<% end %>

<%= render 'shared/analytics' %>
```

```erb
<%# app/views/shared/_analytics.html.erb %>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX'<%= yield(:ga4_extra) ? ', {' + yield(:ga4_extra) + '}' : '' %>);
</script>
```

---

## Shared Navigation Patterns

### Approach 1: Link-Based (Recommended)

The simplest approach. Both sites maintain independent navigation that link to each other.

**Pros:**
- Complete code isolation
- No integration maintenance
- Best SEO (crawlable links)
- No JavaScript dependency

**Cons:**
- Inconsistent navigation if not manually synced
- User experience may differ between sites

```html
<!-- Host site nav -->
<nav>
  <a href="/">Home</a>
  <a href="/blog/">Blog</a>
</nav>

<!-- Blog nav -->
<nav>
  <a href="/">Home</a>
  <a href="/blog/">Blog</a>
</nav>
```

---

### Approach 2: Component Sharing

Host site shares navigation components or data with the blog.

**Pros:**
- Consistent navigation across sites
- Single source of truth for nav items
- Dynamic updates propagate automatically

**Cons:**
- Tight coupling between codebases
- Requires compatible framework or API layer
- More complex deployment

```tsx
// Example: Next.js consuming shared nav config
const [navItems, setNavItems] = useState([])

useEffect(() => {
  fetch('/api/navigation')
    .then(r => r.json())
    .then(setNavItems)
}, [])

return (
  <nav>
    {navItems.map(item => (
      <Link key={item.href} href={item.href}>
        {item.label}
      </Link>
    ))}
  </nav>
)
```

---

### Approach 3: iframe with postMessage

Complete isolation via iframe communication.

**Pros:**
- Complete runtime isolation
- No shared state or coupling
- Graceful degradation if one site fails

**Cons:**
- SEO challenges (iframe content may not be indexed)
- Complex communication setup
- Accessibility considerations

```html
<!-- Host site -->
<iframe 
  id="blog-nav" 
  src="/blog/navigation.html"
  title="Blog Navigation"
></iframe>

<script>
window.addEventListener('message', (e) => {
  if (e.data.type === 'nav-height') {
    document.getElementById('blog-nav').style.height = e.data.height + 'px'
  }
})
</script>
```

```javascript
// Blog navigation iframe
const nav = document.querySelector('nav')

function sendHeight() {
  parent.postMessage({ type: 'nav-height', height: nav.offsetHeight }, '*')
}

window.addEventListener('resize', sendHeight)
sendHeight()
```

---

## Shared Footer Patterns

Footer integration follows the same three approaches as navigation:

| Approach | SEO Impact | Maintenance | Consistency |
|----------|------------|-------------|-------------|
| Link-based | Excellent | Manual | Variable |
| Component sharing | Excellent | Automated | High |
| iframe | Poor | Isolated | High |

**Recommended Setup:**
```html
<!-- Host site layout -->
<footer>
  <%= render 'shared/footer_links' %>
  <small>&copy; 2026 Company Name</small>
</footer>

<!-- Blog layout -->
<footer>
  <nav>
    <a href="/">Home</a>
    <a href="/blog/">Blog</a>
  </nav>
  <small>&copy; 2026 Company Name</small>
</footer>
```

---

## Shared Analytics

### GA4 Single Property with Content Grouping

Use one GA4 property for both sites with content groups for filtering.

```javascript
// Common config on all pages
gtag('config', 'G-XXXXXXXXXX', {
  'content_group': 'main'
});

// Blog pages
gtag('config', 'G-XXXXXXXXXX', {
  'content_group': 'blog'
});
```

**Viewing Blog-Specific Data:**
1. Go to GA4 Reports > Traffic acquisition
2. Create a custom dimension for content group
3. Filter by `content_group == blog`
4. Compare engagement metrics between groups

### GTM Container Sharing

Single GTM container manages all tracking.

```javascript
// GTM Trigger Configuration
// Trigger 1: All pages
Trigger Type: Page View
Filter: None

// Trigger 2: Blog pages only  
Trigger Type: Page View
Filter: Page Path contains /blog/

// Trigger 3: Blog posts
Trigger Type: Page View
Filter: Page Path matches RegEx ^/blog/\d{4}/.*/
```

**Blog-Specific Events:**
```javascript
// Fire on blog pages
dataLayer.push({
  'event': 'blog_view',
  'blog_category': 'technical',
  'blog_author': 'author-name'
})
```

### Tracking Configuration

```javascript
// Recommended GA4 event naming
'event': 'page_view'           // Standard
'event': 'blog_view'           // Blog homepage
'event': 'post_view'           // Individual post
'event': 'category_view'       // Category page
'event': 'search_results'      // Search results
'event': 'newsletter_signup'   // Conversions
```

---

## Domain Handling

### Same-Domain (Recommended)

```
example.com/blog/
```

**Benefits:**
- Full SEO authority sharing between main site and blog
- Single origin for cookies and authentication
- Simplified analytics and tracking
- Best user experience (consistent domain)

**Configuration:**
```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://example.com',
  base: '/blog'
})
```

---

### Subdomain

```
blog.example.com
```

**Benefits:**
- Still shares root domain authority
- Clear visual separation
- Easier to manage separate deployments

**SEO Impact:**
- Shares ~85-90% of root domain authority
- Treats as separate property by some crawlers
- Requires canonical tags pointing to main domain if duplicate content exists

**Configuration:**
```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://blog.example.com'
})
```

---

### Separate Domain

```
blog.example.net (different TLD)
```

**Benefits:**
- Complete brand separation
- Independent analytics and cookies
- Suitable for acquired/acquired content

**SEO Impact:**
- No authority sharing
- Treats as completely different property
- Requires separate sitemap submission
- Full backlink profile separate

**Configuration:**
```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://blog.example.net'
})
```

---

## Shared Fonts

### Method 1: Import from Host Site

```css
/* In blog's main CSS file */
@import url('https://example.com/fonts/host-fonts.css');

/* Or specific font import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --font-primary: 'Inter', system-ui, sans-serif;
}
```

### Method 2: Google Fonts API

```css
/* Match host site's Google Fonts choices */
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Inter:wght@400;500;600&display=swap');

:root {
  --font-heading: 'Merriweather', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
```

### Method 3: Self-Hosted Fonts

```bash
# Copy fonts to public directory
mkdir -p public/fonts
cp /path/to/host-fonts/* public/fonts/
```

```css
@font-face {
  font-family: 'Host Font';
  src: url('/fonts/host-font.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap;
}

:root {
  --font-primary: 'Host Font', system-ui, sans-serif;
}
```

---

## Shared Color System

### Architecture

```
Host Site                    Blog (Sidecar)
-----------                  -------------
:root {                     :root {
  --color-primary: blue;      @import '/css/host-tokens.css';
  --color-secondary: green;   
}                            :root {
                               --blog-accent: var(--color-primary);
                               --blog-surface: var(--color-gray-50);
                             }
```

### Implementation

**Step 1: Export host tokens to CSS file**

```css
/* Host site: public/css/tokens.css */
:root {
  --color-primary: #2563eb;
  --color-primary-dark: #1d4ed8;
  --color-secondary: #059669;
  --color-surface: #f8fafc;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --spacing-unit: 0.25rem;
  --radius-md: 0.375rem;
}
```

**Step 2: Blog imports host tokens**

```css
/* Blog: src/styles/tokens.css */
@import 'https://example.com/css/tokens.css';

/* Blog-specific semantic overrides */
:root {
  /* Semantic tokens that inherit from host design tokens */
  --blog-text: var(--color-text);
  --blog-heading: var(--color-primary);
  --blog-accent: var(--color-primary);
  --blog-background: white;
  --blog-surface: var(--color-surface);
  
  /* Blog-only tokens */
  --blog-callout-info: #dbeafe;
  --blog-callout-warning: #fef3c7;
  --blog-callout-tip: #d1fae5;
}
```

**Step 3: Use semantic tokens in components**

```css
/* Blog component styles */
.article-title {
  color: var(--blog-heading);
}

.article-body {
  color: var(--blog-text);
  background: var(--blog-background);
}

.callout {
  background: var(--blog-callout-info);
  border-left: 4px solid var(--blog-accent);
}
```

### Token Naming Convention

| Token Type | Example | Purpose |
|------------|---------|---------|
| Primitive | `--color-blue-500` | Raw values |
| Semantic | `--color-primary` | Contextual meaning |
| Component | `--button-bg` | Specific to components |
| Blog Override | `--blog-accent` | Blog-specific overrides |

---

## Quick Start Checklist

- [ ] Build Astro blog: `npm run build`
- [ ] Deploy dist/ to host site `/blog/` path
- [ ] Add navigation link from host site to `/blog/`
- [ ] Import host CSS variables into blog
- [ ] Configure analytics with content grouping
- [ ] Test navigation between sites
- [ ] Verify fonts load correctly
- [ ] Check mobile responsiveness
- [ ] Submit blog sitemap to search engines
