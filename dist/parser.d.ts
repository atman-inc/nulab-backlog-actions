import { ParsedAnnotation } from './types';
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
export declare function parseAnnotations(text: string): ParsedAnnotation[];
/**
 * Extract all Backlog issue keys from text (without action keywords)
 * This is useful for adding comments to referenced issues
 *
 * @param text - The text to parse
 * @returns Array of unique issue keys
 */
export declare function extractIssueKeys(text: string): string[];
