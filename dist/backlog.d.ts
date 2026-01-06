import { BacklogConfig } from './types';
/**
 * Backlog API client wrapper using official backlog-js library
 */
export declare class BacklogClient {
    private readonly client;
    constructor(config: BacklogConfig);
    /**
     * Get issue by key or ID
     */
    getIssue(issueIdOrKey: string): Promise<import("backlog-js/dist/types/entity").Issue.Issue>;
    /**
     * Add a comment to an issue
     */
    addComment(issueIdOrKey: string, content: string): Promise<import("backlog-js/dist/types/entity").Issue.Comment>;
    /**
     * Update issue status
     */
    updateIssueStatus(issueIdOrKey: string, statusId: number): Promise<import("backlog-js/dist/types/entity").Issue.Issue>;
    /**
     * Get project statuses
     */
    getProjectStatuses(projectIdOrKey: string | number): Promise<import("backlog-js/dist/types/entity").Project.ProjectStatus[]>;
    /**
     * Check if an issue exists
     */
    issueExists(issueIdOrKey: string): Promise<boolean>;
}
