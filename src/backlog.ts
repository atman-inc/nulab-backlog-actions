import * as core from '@actions/core';
import { BacklogConfig, BacklogIssue, BacklogComment, BacklogStatus } from './types';

/**
 * Backlog API client
 */
export class BacklogClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: BacklogConfig) {
    // Ensure host doesn't have protocol
    const host = config.host.replace(/^https?:\/\//, '');
    this.baseUrl = `https://${host}/api/v2`;
    this.apiKey = config.apiKey;
  }

  /**
   * Make an API request to Backlog
   */
  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}?apiKey=${this.apiKey}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = new URLSearchParams(
        Object.entries(body).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();
    }

    core.debug(`Backlog API: ${method} ${path}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Backlog API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get issue by key or ID
   */
  async getIssue(issueIdOrKey: string): Promise<BacklogIssue> {
    return this.request<BacklogIssue>('GET', `/issues/${issueIdOrKey}`);
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueIdOrKey: string, content: string): Promise<BacklogComment> {
    return this.request<BacklogComment>('POST', `/issues/${issueIdOrKey}/comments`, {
      content,
    });
  }

  /**
   * Update issue status
   */
  async updateIssueStatus(issueIdOrKey: string, statusId: number): Promise<BacklogIssue> {
    return this.request<BacklogIssue>('PATCH', `/issues/${issueIdOrKey}`, {
      statusId,
    });
  }

  /**
   * Get project statuses
   */
  async getProjectStatuses(projectIdOrKey: string | number): Promise<BacklogStatus[]> {
    return this.request<BacklogStatus[]>('GET', `/projects/${projectIdOrKey}/statuses`);
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
