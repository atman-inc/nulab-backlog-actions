import { BacklogConfig, BacklogIssue, BacklogComment, BacklogStatus } from './types';
/**
 * Backlog API client
 */
export declare class BacklogClient {
    private readonly baseUrl;
    private readonly apiKey;
    constructor(config: BacklogConfig);
    /**
     * Make an API request to Backlog
     */
    private request;
    /**
     * Get issue by key or ID
     */
    getIssue(issueIdOrKey: string): Promise<BacklogIssue>;
    /**
     * Add a comment to an issue
     */
    addComment(issueIdOrKey: string, content: string): Promise<BacklogComment>;
    /**
     * Update issue status
     */
    updateIssueStatus(issueIdOrKey: string, statusId: number): Promise<BacklogIssue>;
    /**
     * Get project statuses
     */
    getProjectStatuses(projectIdOrKey: string | number): Promise<BacklogStatus[]>;
    /**
     * Check if an issue exists
     */
    issueExists(issueIdOrKey: string): Promise<boolean>;
}
