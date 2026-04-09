export interface GuardrailResult {
  passed: boolean;
  reason?: string;
  requiresApproval: boolean;
}

// Tags that require human review before publishing
const APPROVAL_TAGS = ['nsfw', 'adult', 'sensitive', 'sponsored'];

// Words/phrases that violate content policy
const BLOCKED_PATTERNS = [
  /\b(illicit|illegal|harmful)\b/i,
  /\b(hate|extremist)\b/i,
];

// Spam patterns
const SPAM_PATTERNS = [
  /\b(buy now|click here|free money)\b/i,
  /https?:\/\/\S+/g, // URLs
  /(.)\1{5,}/g, // repeated characters
];

export function requireApproval(tags: string[]): GuardrailResult {
  const flagged = tags.filter(tag => APPROVAL_TAGS.includes(tag.toLowerCase()));
  
  if (flagged.length > 0) {
    return {
      passed: true,
      reason: `Tags ${flagged.join(', ')} require human review`,
      requiresApproval: true,
    };
  }
  
  return { passed: true, requiresApproval: false };
}

export function contentPolicyCheck(content: string): GuardrailResult {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      return {
        passed: false,
        reason: 'Content violates policy guidelines',
        requiresApproval: false,
      };
    }
  }
  
  return { passed: true, requiresApproval: false };
}

export function spamScoreCheck(content: string): GuardrailResult {
  let spamScore = 0;
  
  for (const pattern of SPAM_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      spamScore += matches.length;
    }
  }
  
  // Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.3) spamScore += 1;
  
  // Check for excessive punctuation
  const punctRatio = (content.match(/[!]{2,}/g) || []).length;
  if (punctRatio > 3) spamScore += 1;
  
  if (spamScore >= 3) {
    return {
      passed: false,
      reason: 'Content appears to be spam',
      requiresApproval: false,
    };
  }
  
  return { passed: true, requiresApproval: false };
}