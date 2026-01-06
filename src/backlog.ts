import { Backlog } from 'backlog-js';
import * as core from '@actions/core';
import { BacklogConfig } from './types';

/**
 * Backlog API client wrapper using official backlog-js library
 */
export class BacklogClient {
  private readonly client: Backlog;

  constructor(config: BacklogConfig) {
    // Ensure host doesn't have protocol
    const host = config.host.replace(/^https?:\/\//, '');
    this.client = new Backlog({
      host,
      apiKey: config.apiKey,
    });
  }

  /**
   * Get issue by key or ID
   */
  async getIssue(issueIdOrKey: string) {
    core.debug(`Getting issue: ${issueIdOrKey}`);
    return this.client.getIssue(issueIdOrKey);
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueIdOrKey: string, content: string) {
    core.debug(`Adding comment to issue: ${issueIdOrKey}`);
    return this.client.postIssueComments(issueIdOrKey, { content });
  }

  /**
   * Update issue status
   */
  async updateIssueStatus(issueIdOrKey: string, statusId: number) {
    core.debug(`Updating issue ${issueIdOrKey} status to: ${statusId}`);
    return this.client.patchIssue(issueIdOrKey, { statusId });
  }

  /**
   * Get project statuses
   */
  async getProjectStatuses(projectIdOrKey: string | number) {
    core.debug(`Getting statuses for project: ${projectIdOrKey}`);
    return this.client.getProjectStatuses(projectIdOrKey);
  }

  /**
   * Check if an issue exists
   */
  async issueExists(issueIdOrKey: string): Promise<boolean> {
    try {
      await this.getIssue(issueIdOrKey);
      return true;
    } catch {
      return false;
    }
  }
}
