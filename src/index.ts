import * as core from '@actions/core';
import * as github from '@actions/github';
import { BacklogClient } from './backlog';
import { parseAnnotations, extractIssueKeys } from './parser';
import { ActionConfig, PullRequestInfo, ParsedAnnotation } from './types';

/**
 * Get action configuration from inputs
 */
export function getConfig(): ActionConfig {
  return {
    backlog: {
      host: core.getInput('backlog_host', { required: true }),
      apiKey: core.getInput('backlog_api_key', { required: true }),
    },
    addComment: core.getBooleanInput('add_comment'),
    updateStatusOnMerge: core.getBooleanInput('update_status_on_merge'),
    fixStatusId: parseInt(core.getInput('fix_status_id') || '3', 10),
    closeStatusId: parseInt(core.getInput('close_status_id') || '4', 10),
  };
}

/**
 * Extract PR information from GitHub context
 */
export function getPullRequestInfo(): PullRequestInfo | null {
  const { payload } = github.context;
  const pr = payload.pull_request;

  if (!pr) {
    return null;
  }

  return {
    number: pr.number,
    title: pr.title || '',
    body: pr.body || '',
    url: pr.html_url || '',
    isDraft: pr.draft || false,
    merged: pr.merged || false,
  };
}

/**
 * Handle PR opened event (non-draft)
 * Adds comment to referenced Backlog issues
 */
export async function handlePullRequestOpened(
  client: BacklogClient,
  pr: PullRequestInfo
): Promise<void> {
  core.info(`Processing PR #${pr.number}: ${pr.title}`);

  // Extract all issue keys from title and body
  const textToSearch = `${pr.title}\n${pr.body}`;
  const issueKeys = extractIssueKeys(textToSearch);

  if (issueKeys.length === 0) {
    core.info('No Backlog issue keys found in PR title or description');
    return;
  }

  core.info(`Found Backlog issue keys: ${issueKeys.join(', ')}`);

  // Add comment to each issue
  for (const issueKey of issueKeys) {
    try {
      const exists = await client.issueExists(issueKey);
      if (!exists) {
        core.warning(`Issue ${issueKey} not found in Backlog, skipping`);
        continue;
      }

      const comment = `GitHub Pull Request がオープンされました:\n${pr.url}\n\n**${pr.title}**`;
      await client.addComment(issueKey, comment);
      core.info(`Added comment to ${issueKey}`);
    } catch (error) {
      core.warning(`Failed to add comment to ${issueKey}: ${error}`);
    }
  }
}

/**
 * Handle PR merged event
 * Updates status of referenced Backlog issues based on annotations
 */
export async function handlePullRequestMerged(
  client: BacklogClient,
  pr: PullRequestInfo,
  config: ActionConfig
): Promise<void> {
  core.info(`Processing merged PR #${pr.number}: ${pr.title}`);

  // Parse annotations from title and body
  const textToSearch = `${pr.title}\n${pr.body}`;
  const annotations = parseAnnotations(textToSearch);

  if (annotations.length === 0) {
    core.info('No action annotations found in PR title or description');
    return;
  }

  core.info(`Found annotations: ${annotations.map(a => `${a.action} ${a.issueKey}`).join(', ')}`);

  // Process each annotation
  for (const annotation of annotations) {
    await processAnnotation(client, annotation, pr, config);
  }
}

/**
 * Process a single annotation - update issue status
 */
export async function processAnnotation(
  client: BacklogClient,
  annotation: ParsedAnnotation,
  pr: PullRequestInfo,
  config: ActionConfig
): Promise<void> {
  const { issueKey, action } = annotation;

  try {
    // Verify issue exists
    const issue = await client.getIssue(issueKey);
    core.info(`Found issue ${issueKey}: ${issue.summary}`);

    // Determine target status based on action
    const targetStatusId = action === 'fix' ? config.fixStatusId : config.closeStatusId;
    const actionLabel = action === 'fix' ? '処理済み' : '完了';

    // Update issue status
    await client.updateIssueStatus(issueKey, targetStatusId);
    core.info(`Updated ${issueKey} status to ${actionLabel} (ID: ${targetStatusId})`);

    // Add a comment about the merge
    const comment = `GitHub Pull Request がマージされました:\n${pr.url}\n\nステータスを「${actionLabel}」に更新しました。`;
    await client.addComment(issueKey, comment);
    core.info(`Added merge comment to ${issueKey}`);
  } catch (error) {
    core.error(`Failed to process annotation for ${issueKey}: ${error}`);
  }
}

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    const config = getConfig();
    const client = new BacklogClient(config.backlog);

    const eventName = github.context.eventName;
    const action = github.context.payload.action;

    core.info(`Event: ${eventName}, Action: ${action}`);

    // Only handle pull_request events
    if (eventName !== 'pull_request') {
      core.info(`Skipping non-pull_request event: ${eventName}`);
      return;
    }

    const pr = getPullRequestInfo();
    if (!pr) {
      core.warning('Could not extract pull request information');
      return;
    }

    // Handle different PR actions
    switch (action) {
      case 'opened':
      case 'reopened':
      case 'ready_for_review':
        // Skip draft PRs
        if (pr.isDraft) {
          core.info('Skipping draft PR');
          return;
        }
        if (config.addComment) {
          await handlePullRequestOpened(client, pr);
        } else {
          core.info('Comment on PR open is disabled');
        }
        break;

      case 'closed':
        // Only process if merged
        if (!pr.merged) {
          core.info('PR was closed without merging, skipping');
          return;
        }
        if (config.updateStatusOnMerge) {
          await handlePullRequestMerged(client, pr, config);
        } else {
          core.info('Status update on merge is disabled');
        }
        break;

      default:
        core.info(`Skipping action: ${action}`);
    }

    core.info('Action completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
