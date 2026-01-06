import * as github from '@actions/github';
export type Octokit = ReturnType<typeof github.getOctokit>;
/**
 * GitHub client wrapper for PR description operations
 */
export declare class GitHubClient {
    private readonly octokit;
    private readonly owner;
    private readonly repo;
    constructor(token: string);
    /**
     * Get PR body (description)
     */
    getPRBody(prNumber: number): Promise<string>;
    /**
     * Update PR body (description)
     */
    updatePRBody(prNumber: number, body: string): Promise<void>;
    /**
     * Check if PR description already has a Backlog link marker for the given issue
     */
    hasBacklogLink(prNumber: number, issueKey: string): Promise<boolean>;
    /**
     * Add Backlog issue link to PR description if not already present
     * Returns true if link was added, false if already exists
     */
    addBacklogLinkToDescription(prNumber: number, backlogHost: string, issueKey: string): Promise<boolean>;
    /**
     * Check if merge was already processed for the given issue
     */
    hasMergeMarker(prNumber: number, issueKey: string): Promise<boolean>;
    /**
     * Add merge marker to PR description
     */
    addMergeMarkerToDescription(prNumber: number, backlogHost: string, issueKey: string, statusLabel: string): Promise<void>;
}
/**
 * Build Backlog issue URL from host and issue key
 */
export declare function buildBacklogIssueUrl(host: string, issueKey: string): string;
/**
 * Build hidden marker for Backlog link tracking
 */
export declare function buildBacklogLinkMarker(issueKey: string): string;
/**
 * Build hidden marker for merge tracking
 */
export declare function buildMergeMarker(issueKey: string): string;
