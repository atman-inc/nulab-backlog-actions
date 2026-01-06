import * as github from '@actions/github';
export type Octokit = ReturnType<typeof github.getOctokit>;
/**
 * GitHub client wrapper for PR comment operations
 */
export declare class GitHubClient {
    private readonly octokit;
    private readonly owner;
    private readonly repo;
    constructor(token: string);
    /**
     * Get all comments on a PR
     */
    getPRComments(prNumber: number): Promise<{
        id: number;
        body: string;
    }[]>;
    /**
     * Add a comment to a PR
     */
    addPRComment(prNumber: number, body: string): Promise<void>;
    /**
     * Check if a PR already has a comment containing the Backlog issue URL
     */
    hasBacklogComment(prNumber: number, backlogHost: string, issueKey: string): Promise<boolean>;
    /**
     * Add Backlog issue link comment to PR if not already present
     * Returns true if comment was added, false if already exists
     */
    addBacklogLinkComment(prNumber: number, backlogHost: string, issueKey: string): Promise<boolean>;
}
/**
 * Build Backlog issue URL from host and issue key
 */
export declare function buildBacklogIssueUrl(host: string, issueKey: string): string;
