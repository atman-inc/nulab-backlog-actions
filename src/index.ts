import * as core from '@actions/core';
import * as github from '@actions/github';
import { BacklogClient } from './backlog';
import { GitHubClient } from './github';
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
    githubToken: core.getInput('github_token', { required: true }),
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
 * Uses GitHub PR comment to track which issues already have comments
 */
export async function handlePullRequestOpened(
  backlogClient: BacklogClient,
  githubClient: GitHubClient,
  pr: PullRequestInfo,
  backlogHost: string
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

  // Add comment to each issue (with duplicate check via GitHub PR comment)
  for (const issueKey of issueKeys) {
    try {
      // Check if we already added a comment for this issue (via GitHub PR comment)
      const hasComment = await githubClient.hasBacklogComment(pr.number, backlogHost, issueKey);
      if (hasComment) {
        core.info(`Already commented on ${issueKey} (found existing PR comment), skipping`);
        continue;
      }

      // Verify issue exists in Backlog
      const exists = await backlogClient.issueExists(issueKey);
      if (!exists) {
        core.warning(`Issue ${issueKey} not found in Backlog, skipping`);
        continue;
      }

      // Add comment to Backlog issue
      const comment = `GitHub Pull Request がオープンされました:\n${pr.url}\n\n**${pr.title}**`;
      await backlogClient.addComment(issueKey, comment);
      core.info(`Added comment to ${issueKey}`);

      // Add Backlog link comment to PR (for tracking)
      await githubClient.addBacklogLinkComment(pr.number, backlogHost, issueKey);
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
  backlogClient: BacklogClient,
  githubClient: GitHubClient,
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
    await processAnnotation(backlogClient, githubClient, annotation, pr, config);
  }
}

/**
 * Process a single annotation - update issue status
 */
export async function processAnnotation(
  backlogClient: BacklogClient,
  githubClient: GitHubClient,
  annotation: ParsedAnnotation,
  pr: PullRequestInfo,
  config: ActionConfig
): Promise<void> {
  const { issueKey, action } = annotation;

  try {
    // Check if we already processed this merge (via GitHub PR comment pattern)
    // We use a special marker in PR comment to indicate merge was processed
    const comments = await githubClient.getPRComments(pr.number);
    const mergeMarker = `<!-- backlog-merged:${issueKey} -->`;
    const alreadyProcessed = comments.some((c) => c.body.includes(mergeMarker));

    if (alreadyProcessed) {
      core.info(`Already processed merge for ${issueKey}, skipping`);
      return;
    }

    // Verify issue exists
    const issue = await backlogClient.getIssue(issueKey);
    core.info(`Found issue ${issueKey}: ${issue.summary}`);

    // Determine target status based on action
    const targetStatusId = action === 'fix' ? config.fixStatusId : config.closeStatusId;
    const actionLabel = action === 'fix' ? '処理済み' : '完了';

    // Update issue status
    await backlogClient.updateIssueStatus(issueKey, targetStatusId);
    core.info(`Updated ${issueKey} status to ${actionLabel} (ID: ${targetStatusId})`);

    // Add a comment about the merge to Backlog
    const backlogComment = `GitHub Pull Request がマージされました:\n${pr.url}\n\nステータスを「${actionLabel}」に更新しました。`;
    await backlogClient.addComment(issueKey, backlogComment);
    core.info(`Added merge comment to ${issueKey}`);

    // Add marker comment to PR (hidden, for tracking)
    const prComment = `${mergeMarker}\nBacklog [${issueKey}](https://${config.backlog.host.replace(/^https?:\/\//, '')}/view/${issueKey}) のステータスを「${actionLabel}」に更新しました。`;
    await githubClient.addPRComment(pr.number, prComment);
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
    const backlogClient = new BacklogClient(config.backlog);
    const githubClient = new GitHubClient(config.githubToken);

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
          await handlePullRequestOpened(backlogClient, githubClient, pr, config.backlog.host);
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
          await handlePullRequestMerged(backlogClient, githubClient, pr, config);
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
