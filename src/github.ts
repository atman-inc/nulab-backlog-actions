import * as github from '@actions/github';
import * as core from '@actions/core';

export type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * GitHub client wrapper for PR comment operations
 */
export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.owner = github.context.repo.owner;
    this.repo = github.context.repo.repo;
  }

  /**
   * Get all comments on a PR
   */
  async getPRComments(prNumber: number): Promise<{ id: number; body: string }[]> {
    const { data } = await this.octokit.rest.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
    });

    return data.map((comment) => ({
      id: comment.id,
      body: comment.body || '',
    }));
  }

  /**
   * Add a comment to a PR
   */
  async addPRComment(prNumber: number, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body,
    });
  }

  /**
   * Check if a PR already has a comment containing the Backlog issue URL
   */
  async hasBacklogComment(prNumber: number, backlogHost: string, issueKey: string): Promise<boolean> {
    const comments = await this.getPRComments(prNumber);
    const backlogIssueUrl = buildBacklogIssueUrl(backlogHost, issueKey);

    return comments.some((comment) => comment.body.includes(backlogIssueUrl));
  }

  /**
   * Add Backlog issue link comment to PR if not already present
   * Returns true if comment was added, false if already exists
   */
  async addBacklogLinkComment(
    prNumber: number,
    backlogHost: string,
    issueKey: string
  ): Promise<boolean> {
    const hasComment = await this.hasBacklogComment(prNumber, backlogHost, issueKey);

    if (hasComment) {
      core.info(`PR #${prNumber} already has a comment for ${issueKey}, skipping`);
      return false;
    }

    const backlogIssueUrl = buildBacklogIssueUrl(backlogHost, issueKey);
    const body = `Backlog: [${issueKey}](${backlogIssueUrl})`;

    await this.addPRComment(prNumber, body);
    core.info(`Added Backlog link comment to PR #${prNumber} for ${issueKey}`);
    return true;
  }
}

/**
 * Build Backlog issue URL from host and issue key
 */
export function buildBacklogIssueUrl(host: string, issueKey: string): string {
  const cleanHost = host.replace(/^https?:\/\//, '');
  return `https://${cleanHost}/view/${issueKey}`;
}
