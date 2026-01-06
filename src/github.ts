import * as github from '@actions/github';
import * as core from '@actions/core';

export type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * GitHub client wrapper for PR description operations
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
   * Get PR body (description)
   */
  async getPRBody(prNumber: number): Promise<string> {
    const { data } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return data.body || '';
  }

  /**
   * Update PR body (description)
   */
  async updatePRBody(prNumber: number, body: string): Promise<void> {
    await this.octokit.rest.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      body,
    });
  }

  /**
   * Check if PR description already has a Backlog link marker for the given issue
   */
  async hasBacklogLink(prNumber: number, issueKey: string): Promise<boolean> {
    const body = await this.getPRBody(prNumber);
    const marker = buildBacklogLinkMarker(issueKey);
    return body.includes(marker);
  }

  /**
   * Add Backlog issue link to PR description if not already present
   * Returns true if link was added, false if already exists
   */
  async addBacklogLinkToDescription(
    prNumber: number,
    backlogHost: string,
    issueKey: string
  ): Promise<boolean> {
    const body = await this.getPRBody(prNumber);
    const marker = buildBacklogLinkMarker(issueKey);

    if (body.includes(marker)) {
      core.info(`PR #${prNumber} already has a link for ${issueKey}, skipping`);
      return false;
    }

    const backlogUrl = buildBacklogIssueUrl(backlogHost, issueKey);
    const linkSection = `\n\n---\n🔗 Backlog: [${issueKey}](${backlogUrl})\n${marker}`;
    const newBody = body + linkSection;

    await this.updatePRBody(prNumber, newBody);
    core.info(`Added Backlog link to PR #${prNumber} description for ${issueKey}`);
    return true;
  }

  /**
   * Check if merge was already processed for the given issue
   */
  async hasMergeMarker(prNumber: number, issueKey: string): Promise<boolean> {
    const body = await this.getPRBody(prNumber);
    const marker = buildMergeMarker(issueKey);
    return body.includes(marker);
  }

  /**
   * Add merge marker to PR description
   */
  async addMergeMarkerToDescription(
    prNumber: number,
    backlogHost: string,
    issueKey: string,
    statusLabel: string
  ): Promise<void> {
    const body = await this.getPRBody(prNumber);
    const marker = buildMergeMarker(issueKey);

    if (body.includes(marker)) {
      return;
    }

    const backlogUrl = buildBacklogIssueUrl(backlogHost, issueKey);
    const statusSection = `\n✅ [${issueKey}](${backlogUrl}) → ${statusLabel}\n${marker}`;
    const newBody = body + statusSection;

    await this.updatePRBody(prNumber, newBody);
  }
}

/**
 * Build Backlog issue URL from host and issue key
 */
export function buildBacklogIssueUrl(host: string, issueKey: string): string {
  const cleanHost = host.replace(/^https?:\/\//, '');
  return `https://${cleanHost}/view/${issueKey}`;
}

/**
 * Build hidden marker for Backlog link tracking
 */
export function buildBacklogLinkMarker(issueKey: string): string {
  return `<!-- backlog-link:${issueKey} -->`;
}

/**
 * Build hidden marker for merge tracking
 */
export function buildMergeMarker(issueKey: string): string {
  return `<!-- backlog-merged:${issueKey} -->`;
}
