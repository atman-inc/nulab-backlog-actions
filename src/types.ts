/**
 * Annotation action types detected from PR title/description
 */
export type AnnotationAction = 'fix' | 'close';

/**
 * Parsed annotation from PR text
 */
export interface ParsedAnnotation {
  /** The Backlog issue key (e.g., "PROJ-123") */
  issueKey: string;
  /** The action to perform */
  action: AnnotationAction;
  /** The original matched text */
  originalText: string;
}

/**
 * Backlog API configuration
 */
export interface BacklogConfig {
  /** Backlog host (e.g., "example.backlog.com" or "example.backlog.jp") */
  host: string;
  /** Backlog API key */
  apiKey: string;
}

/**
 * Action configuration
 */
export interface ActionConfig {
  /** Backlog API configuration */
  backlog: BacklogConfig;
  /** Whether to add comment on PR open */
  addComment: boolean;
  /** Whether to update status on PR merge */
  updateStatusOnMerge: boolean;
  /** Status ID to set for fix actions */
  fixStatusId: number;
  /** Status ID to set for close actions */
  closeStatusId: number;
}

/**
 * Pull Request information
 */
export interface PullRequestInfo {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR description/body */
  body: string;
  /** PR URL */
  url: string;
  /** Whether PR is a draft */
  isDraft: boolean;
  /** Whether PR is merged */
  merged: boolean;
}
