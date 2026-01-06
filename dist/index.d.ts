import { BacklogClient } from './backlog';
import { GitHubClient } from './github';
import { ActionConfig, PullRequestInfo, ParsedAnnotation } from './types';
/**
 * Get action configuration from inputs
 */
export declare function getConfig(): ActionConfig;
/**
 * Extract PR information from GitHub context
 */
export declare function getPullRequestInfo(): PullRequestInfo | null;
/**
 * Handle PR opened event (non-draft)
 * Adds comment to referenced Backlog issues
 * Uses GitHub PR comment to track which issues already have comments
 */
export declare function handlePullRequestOpened(backlogClient: BacklogClient, githubClient: GitHubClient, pr: PullRequestInfo, backlogHost: string): Promise<void>;
/**
 * Handle PR merged event
 * Updates status of referenced Backlog issues based on annotations
 */
export declare function handlePullRequestMerged(backlogClient: BacklogClient, githubClient: GitHubClient, pr: PullRequestInfo, config: ActionConfig): Promise<void>;
/**
 * Process a single annotation - update issue status
 */
export declare function processAnnotation(backlogClient: BacklogClient, githubClient: GitHubClient, annotation: ParsedAnnotation, pr: PullRequestInfo, config: ActionConfig): Promise<void>;
