import { BacklogClient } from './backlog';
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
 */
export declare function handlePullRequestOpened(client: BacklogClient, pr: PullRequestInfo): Promise<void>;
/**
 * Handle PR merged event
 * Updates status of referenced Backlog issues based on annotations
 */
export declare function handlePullRequestMerged(client: BacklogClient, pr: PullRequestInfo, config: ActionConfig): Promise<void>;
/**
 * Process a single annotation - update issue status
 */
export declare function processAnnotation(client: BacklogClient, annotation: ParsedAnnotation, pr: PullRequestInfo, config: ActionConfig): Promise<void>;
