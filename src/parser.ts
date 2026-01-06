import { ParsedAnnotation, AnnotationAction } from './types';

/**
 * Keywords that trigger "fix" action (maps to "処理済み" status)
 * These keywords indicate the PR fixes/resolves an issue
 */
const FIX_KEYWORDS = ['fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved'];

/**
 * Keywords that trigger "close" action (maps to "完了" status)
 * These keywords indicate the PR closes/completes an issue
 */
const CLOSE_KEYWORDS = ['close', 'closes', 'closed'];

/**
 * All supported keywords
 */
const ALL_KEYWORDS = [...FIX_KEYWORDS, ...CLOSE_KEYWORDS];

/**
 * Regular expression pattern for matching Backlog issue keys
 * Format: PROJECT_KEY-NUMBER (e.g., "PROJ-123", "MY_PROJECT-1")
 * Project keys: 1-25 characters, uppercase letters, numbers, and underscores (must start with letter)
 * Issue ID: 1-6 digits
 */
const ISSUE_KEY_PATTERN = '[A-Z][A-Z0-9_]{0,24}-\\d{1,6}';

/**
 * Build regex pattern for annotation matching
 * Matches patterns like:
 * - "fixes PROJ-123"
 * - "fix: PROJ-123"
 * - "closes #PROJ-123"
 */
function buildAnnotationPattern(): RegExp {
  const keywordsGroup = ALL_KEYWORDS.join('|');
  // Pattern: keyword followed by optional punctuation and optional # before issue key
  const pattern = `\\b(${keywordsGroup})\\s*[:：]?\\s*#?(${ISSUE_KEY_PATTERN})\\b`;
  return new RegExp(pattern, 'gi');
}

/**
 * Determine the action type based on the keyword
 */
function getActionFromKeyword(keyword: string): AnnotationAction {
  const lowerKeyword = keyword.toLowerCase();
  if (FIX_KEYWORDS.includes(lowerKeyword)) {
    return 'fix';
  }
  if (CLOSE_KEYWORDS.includes(lowerKeyword)) {
    return 'close';
  }
  // Default to fix (should not happen with proper regex)
  return 'fix';
}

/**
 * Parse annotations from text (PR title or description)
 *
 * Supports formats:
 * - "fixes PROJ-123"
 * - "close: PROJ-123"
 * - "resolves #PROJ-123"
 *
 * @param text - The text to parse (PR title or description)
 * @returns Array of parsed annotations
 */
export function parseAnnotations(text: string): ParsedAnnotation[] {
  if (!text) {
    return [];
  }

  const pattern = buildAnnotationPattern();
  const annotations: ParsedAnnotation[] = [];
  const seenIssueKeys = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const [originalText, keyword, issueKey] = match;
    const normalizedKey = issueKey.toUpperCase();

    // Skip duplicates (same issue key)
    if (seenIssueKeys.has(normalizedKey)) {
      continue;
    }
    seenIssueKeys.add(normalizedKey);

    annotations.push({
      issueKey: normalizedKey,
      action: getActionFromKeyword(keyword),
      originalText: originalText.trim(),
    });
  }

  return annotations;
}

/**
 * Extract all Backlog issue keys from text (without action keywords)
 * This is useful for adding comments to referenced issues
 *
 * @param text - The text to parse
 * @returns Array of unique issue keys
 */
export function extractIssueKeys(text: string): string[] {
  if (!text) {
    return [];
  }

  // Use word boundaries to ensure we match complete issue keys only
  const pattern = new RegExp(`(?<![A-Z0-9_])${ISSUE_KEY_PATTERN}(?!\\d)`, 'gi');
  const keys = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    keys.add(match[0].toUpperCase());
  }

  return Array.from(keys);
}
