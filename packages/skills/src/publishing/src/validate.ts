export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code?: string;
}

const RESERVED_SLUGS = ['admin', 'api', 'blog', 'css', 'js', 'json', 'rss', 'sitemap', 'robots'];

export function validateFrontmatter(frontmatter: Record<string, any>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // title
  if (!frontmatter.title) {
    errors.push({ field: 'title', message: 'Title is required', code: 'MISSING_TITLE' });
  } else if (typeof frontmatter.title !== 'string') {
    errors.push({ field: 'title', message: 'Title must be a string', code: 'INVALID_TITLE_TYPE' });
  } else if (frontmatter.title.length > 80) {
    errors.push({ field: 'title', message: 'Title must be under 80 characters', code: 'TITLE_TOO_LONG' });
  }
  
  // description
  if (!frontmatter.description) {
    errors.push({ field: 'description', message: 'Description is required', code: 'MISSING_DESCRIPTION' });
  } else if (frontmatter.description.length > 200) {
    errors.push({ field: 'description', message: 'Description must be under 200 characters', code: 'DESCRIPTION_TOO_LONG' });
  }
  
  // pubDate
  if (!frontmatter.pubDate) {
    errors.push({ field: 'pubDate', message: 'Publication date is required', code: 'MISSING_PUB_DATE' });
  } else {
    const date = new Date(frontmatter.pubDate);
    if (isNaN(date.getTime())) {
      errors.push({ field: 'pubDate', message: 'Invalid date format', code: 'INVALID_DATE' });
    }
  }
  
  // author
  if (!frontmatter.author) {
    errors.push({ field: 'author', message: 'Author is required', code: 'MISSING_AUTHOR' });
  }
  
  // category
  if (!frontmatter.category) {
    errors.push({ field: 'category', message: 'Category is required', code: 'MISSING_CATEGORY' });
  }
  
  // tags
  if (!frontmatter.tags) {
    errors.push({ field: 'tags', message: 'At least one tag is required', code: 'MISSING_TAGS' });
  } else if (!Array.isArray(frontmatter.tags)) {
    errors.push({ field: 'tags', message: 'Tags must be an array', code: 'INVALID_TAGS_TYPE' });
  } else if (frontmatter.tags.length > 10) {
    errors.push({ field: 'tags', message: 'Maximum 10 tags allowed', code: 'TOO_MANY_TAGS' });
  }
  
  // excerpt
  if (!frontmatter.excerpt) {
    warnings.push({ field: 'excerpt', message: 'Excerpt is recommended for SEO' });
  } else if (frontmatter.excerpt.length > 160) {
    warnings.push({ field: 'excerpt', message: 'Excerpt should be under 160 characters for search results' });
  }
  
  // schemaType
  const validSchemaTypes = ['Article', 'BlogPosting', 'TechArticle', 'HowTo', 'FAQPage'];
  if (frontmatter.schemaType && !validSchemaTypes.includes(frontmatter.schemaType)) {
    errors.push({ field: 'schemaType', message: `schemaType must be one of ${validSchemaTypes.join(', ')}`, code: 'INVALID_SCHEMA_TYPE' });
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export function validateSlug(slug: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (!slug) {
    errors.push({ field: 'slug', message: 'Slug is required', code: 'MISSING_SLUG' });
    return { valid: false, errors, warnings };
  }
  
  if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.push({ field: 'slug', message: 'Slug must be lowercase with hyphens only', code: 'INVALID_SLUG_CHARS' });
  }
  
  if (slug.length < 3 || slug.length > 63) {
    errors.push({ field: 'slug', message: 'Slug must be 3-63 characters', code: 'INVALID_SLUG_LENGTH' });
  }
  
  if (RESERVED_SLUGS.includes(slug)) {
    errors.push({ field: 'slug', message: `Slug '${slug}' is reserved`, code: 'RESERVED_SLUG' });
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export function validateAltText(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Check for images without alt text
  const imgWithoutAlt = /<img(?![^>]*alt=)(?![^>]*alt="")[^>]*>/gi;
  const matches = content.match(imgWithoutAlt);
  if (matches) {
    errors.push({ 
      field: 'images', 
      message: `Found ${matches.length} image(s) without alt text`, 
      code: 'MISSING_ALT_TEXT' 
    });
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export function lintContent(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Check for lorem ipsum
  if (/lorem\s?ipsum/i.test(content)) {
    errors.push({ field: 'content', message: 'Content contains placeholder "lorem ipsum" text', code: 'HAS_PLACEHOLDER' });
  }
  
  // Check minimum word count
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  if (wordCount < 300) {
    warnings.push({ field: 'content', message: `Content has only ${wordCount} words (minimum 300 recommended)`, code: 'LOW_WORD_COUNT' });
  }
  
  // Check for broken link placeholders
  if (/\[.*\]\(\s*\)/.test(content)) {
    warnings.push({ field: 'links', message: 'Found empty link syntax []()', code: 'EMPTY_LINK' });
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export function detectDuplicateTopic(topic: string, existingPosts: string[]): ValidationResult {
  const warnings: ValidationWarning[] = [];
  
  const similar = existingPosts.filter(existing => 
    existing.toLowerCase().includes(topic.toLowerCase()) ||
    topic.toLowerCase().includes(existing.toLowerCase())
  );
  
  if (similar.length > 0) {
    warnings.push({ 
      field: 'topic', 
      message: `Similar posts exist: ${similar.join(', ')}`, 
      code: 'DUPLICATE_TOPIC' 
    });
  }
  
  return { valid: true, errors: [], warnings };
}