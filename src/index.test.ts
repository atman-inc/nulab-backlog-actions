import * as core from '@actions/core';
import * as github from '@actions/github';
import { BacklogClient } from './backlog';
import { GitHubClient } from './github';
import {
  getConfig,
  getPullRequestInfo,
  handlePullRequestOpened,
  handlePullRequestMerged,
  processAnnotation,
} from './index';
import { ActionConfig, PullRequestInfo, ParsedAnnotation } from './types';

// Mock the dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');

describe('getConfig', () => {
  const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;
  const mockGetBooleanInput = core.getBooleanInput as jest.MockedFunction<typeof core.getBooleanInput>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return config with all required fields', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'backlog_host': 'example.backlog.com',
        'backlog_api_key': 'test-api-key',
        'github_token': 'test-github-token',
        'fix_status_id': '3',
        'close_status_id': '4',
      };
      return inputs[name] || '';
    });

    mockGetBooleanInput.mockImplementation((name: string) => {
      const inputs: Record<string, boolean> = {
        'add_comment': true,
        'update_status_on_merge': true,
      };
      return inputs[name] || false;
    });

    const config = getConfig();

    expect(config).toEqual({
      backlog: {
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      },
      githubToken: 'test-github-token',
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    });
  });

  it('should use default status IDs when not provided', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'backlog_host': 'example.backlog.com',
        'backlog_api_key': 'test-api-key',
        'github_token': 'test-github-token',
      };
      return inputs[name] || '';
    });

    mockGetBooleanInput.mockReturnValue(false);

    const config = getConfig();

    expect(config.fixStatusId).toBe(3);
    expect(config.closeStatusId).toBe(4);
  });
});

describe('getPullRequestInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract PR information from GitHub context', () => {
    const mockContext = {
      payload: {
        pull_request: {
          number: 123,
          title: 'Test PR',
          body: 'Test description',
          html_url: 'https://github.com/test/repo/pull/123',
          draft: false,
          merged: false,
        },
      },
    };

    (github.context as any) = mockContext;

    const prInfo = getPullRequestInfo();

    expect(prInfo).toEqual({
      number: 123,
      title: 'Test PR',
      body: 'Test description',
      url: 'https://github.com/test/repo/pull/123',
      isDraft: false,
      merged: false,
    });
  });

  it('should return null when no PR in context', () => {
    const mockContext = {
      payload: {},
    };

    (github.context as any) = mockContext;

    const prInfo = getPullRequestInfo();

    expect(prInfo).toBeNull();
  });
});

describe('handlePullRequestOpened', () => {
  let mockBacklogClient: jest.Mocked<BacklogClient>;
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
  const mockWarning = core.warning as jest.MockedFunction<typeof core.warning>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBacklogClient = {
      issueExists: jest.fn(),
      addComment: jest.fn(),
      getIssue: jest.fn(),
      updateIssueStatus: jest.fn(),
      getProjectStatuses: jest.fn(),
    } as any;
    mockGitHubClient = {
      hasBacklogComment: jest.fn(),
      addBacklogLinkComment: jest.fn(),
      getPRComments: jest.fn(),
      addPRComment: jest.fn(),
    } as any;
  });

  it('should add comment to Backlog issues found in PR', async () => {
    const pr: PullRequestInfo = {
      number: 123,
      title: 'Fix PROJ-123',
      body: 'This fixes the issue',
      url: 'https://github.com/test/repo/pull/123',
      isDraft: false,
      merged: false,
    };

    mockGitHubClient.hasBacklogComment.mockResolvedValue(false);
    mockBacklogClient.issueExists.mockResolvedValue(true);
    mockBacklogClient.addComment.mockResolvedValue({} as any);
    mockGitHubClient.addBacklogLinkComment.mockResolvedValue(true);

    await handlePullRequestOpened(mockBacklogClient, mockGitHubClient, pr, 'example.backlog.com');

    expect(mockGitHubClient.hasBacklogComment).toHaveBeenCalledWith(123, 'example.backlog.com', 'PROJ-123');
    expect(mockBacklogClient.issueExists).toHaveBeenCalledWith('PROJ-123');
    expect(mockBacklogClient.addComment).toHaveBeenCalledWith(
      'PROJ-123',
      expect.stringContaining('GitHub Pull Request がオープンされました')
    );
    expect(mockGitHubClient.addBacklogLinkComment).toHaveBeenCalledWith(123, 'example.backlog.com', 'PROJ-123');
  });

  it('should skip if already commented (via PR comment check)', async () => {
    const pr: PullRequestInfo = {
      number: 123,
      title: 'Fix PROJ-123',
      body: 'This fixes the issue',
      url: 'https://github.com/test/repo/pull/123',
      isDraft: false,
      merged: false,
    };

    mockGitHubClient.hasBacklogComment.mockResolvedValue(true);

    await handlePullRequestOpened(mockBacklogClient, mockGitHubClient, pr, 'example.backlog.com');

    expect(mockBacklogClient.issueExists).not.toHaveBeenCalled();
    expect(mockBacklogClient.addComment).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('Already commented on PROJ-123')
    );
  });

  it('should skip non-existent issues', async () => {
    const pr: PullRequestInfo = {
      number: 789,
      title: 'Fix PROJ-999',
      body: 'Non-existent issue',
      url: 'https://github.com/test/repo/pull/789',
      isDraft: false,
      merged: false,
    };

    mockGitHubClient.hasBacklogComment.mockResolvedValue(false);
    mockBacklogClient.issueExists.mockResolvedValue(false);

    await handlePullRequestOpened(mockBacklogClient, mockGitHubClient, pr, 'example.backlog.com');

    expect(mockBacklogClient.addComment).not.toHaveBeenCalled();
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('PROJ-999 not found')
    );
  });

  it('should handle PR with no issue keys', async () => {
    const pr: PullRequestInfo = {
      number: 111,
      title: 'Regular PR',
      body: 'No issue keys here',
      url: 'https://github.com/test/repo/pull/111',
      isDraft: false,
      merged: false,
    };

    await handlePullRequestOpened(mockBacklogClient, mockGitHubClient, pr, 'example.backlog.com');

    expect(mockGitHubClient.hasBacklogComment).not.toHaveBeenCalled();
    expect(mockBacklogClient.issueExists).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('No Backlog issue keys found')
    );
  });
});

describe('handlePullRequestMerged', () => {
  let mockBacklogClient: jest.Mocked<BacklogClient>;
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBacklogClient = {
      issueExists: jest.fn(),
      addComment: jest.fn(),
      getIssue: jest.fn(),
      updateIssueStatus: jest.fn(),
      getProjectStatuses: jest.fn(),
    } as any;
    mockGitHubClient = {
      hasBacklogComment: jest.fn(),
      addBacklogLinkComment: jest.fn(),
      getPRComments: jest.fn(),
      addPRComment: jest.fn(),
    } as any;
  });

  it('should process fix annotations', async () => {
    const pr: PullRequestInfo = {
      number: 123,
      title: 'fixes PROJ-123',
      body: 'Fixed the bug',
      url: 'https://github.com/test/repo/pull/123',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      githubToken: 'test-token',
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockGitHubClient.getPRComments.mockResolvedValue([]);
    mockBacklogClient.getIssue.mockResolvedValue({
      id: 1,
      issueKey: 'PROJ-123',
      summary: 'Test issue',
    } as any);
    mockBacklogClient.updateIssueStatus.mockResolvedValue({} as any);
    mockBacklogClient.addComment.mockResolvedValue({} as any);
    mockGitHubClient.addPRComment.mockResolvedValue();

    await handlePullRequestMerged(mockBacklogClient, mockGitHubClient, pr, config);

    expect(mockBacklogClient.getIssue).toHaveBeenCalledWith('PROJ-123');
    expect(mockBacklogClient.updateIssueStatus).toHaveBeenCalledWith('PROJ-123', 3);
    expect(mockBacklogClient.addComment).toHaveBeenCalledWith(
      'PROJ-123',
      expect.stringContaining('処理済み')
    );
  });

  it('should handle PR with no annotations', async () => {
    const pr: PullRequestInfo = {
      number: 789,
      title: 'Regular merge',
      body: 'No annotations',
      url: 'https://github.com/test/repo/pull/789',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      githubToken: 'test-token',
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    await handlePullRequestMerged(mockBacklogClient, mockGitHubClient, pr, config);

    expect(mockBacklogClient.getIssue).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('No action annotations found')
    );
  });
});

describe('processAnnotation', () => {
  let mockBacklogClient: jest.Mocked<BacklogClient>;
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
  const mockError = core.error as jest.MockedFunction<typeof core.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBacklogClient = {
      issueExists: jest.fn(),
      addComment: jest.fn(),
      getIssue: jest.fn(),
      updateIssueStatus: jest.fn(),
      getProjectStatuses: jest.fn(),
    } as any;
    mockGitHubClient = {
      hasBacklogComment: jest.fn(),
      addBacklogLinkComment: jest.fn(),
      getPRComments: jest.fn(),
      addPRComment: jest.fn(),
    } as any;
  });

  it('should update status for fix action', async () => {
    const annotation: ParsedAnnotation = {
      issueKey: 'PROJ-123',
      action: 'fix',
      originalText: 'fixes PROJ-123',
    };

    const pr: PullRequestInfo = {
      number: 123,
      title: 'Test',
      body: '',
      url: 'https://github.com/test/repo/pull/123',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      githubToken: 'test-token',
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockGitHubClient.getPRComments.mockResolvedValue([]);
    mockBacklogClient.getIssue.mockResolvedValue({
      id: 1,
      issueKey: 'PROJ-123',
      summary: 'Test issue',
    } as any);
    mockBacklogClient.updateIssueStatus.mockResolvedValue({} as any);
    mockBacklogClient.addComment.mockResolvedValue({} as any);
    mockGitHubClient.addPRComment.mockResolvedValue();

    await processAnnotation(mockBacklogClient, mockGitHubClient, annotation, pr, config);

    expect(mockBacklogClient.updateIssueStatus).toHaveBeenCalledWith('PROJ-123', 3);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('処理済み')
    );
  });

  it('should skip if already processed (merge marker exists)', async () => {
    const annotation: ParsedAnnotation = {
      issueKey: 'PROJ-123',
      action: 'fix',
      originalText: 'fixes PROJ-123',
    };

    const pr: PullRequestInfo = {
      number: 123,
      title: 'Test',
      body: '',
      url: 'https://github.com/test/repo/pull/123',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      githubToken: 'test-token',
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockGitHubClient.getPRComments.mockResolvedValue([
      { id: 1, body: '<!-- backlog-merged:PROJ-123 -->\nStatus updated' },
    ]);

    await processAnnotation(mockBacklogClient, mockGitHubClient, annotation, pr, config);

    expect(mockBacklogClient.getIssue).not.toHaveBeenCalled();
    expect(mockBacklogClient.updateIssueStatus).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('Already processed merge for PROJ-123')
    );
  });

  it('should handle errors gracefully', async () => {
    const annotation: ParsedAnnotation = {
      issueKey: 'PROJ-999',
      action: 'fix',
      originalText: 'fixes PROJ-999',
    };

    const pr: PullRequestInfo = {
      number: 999,
      title: 'Test',
      body: '',
      url: 'https://github.com/test/repo/pull/999',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      githubToken: 'test-token',
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockGitHubClient.getPRComments.mockResolvedValue([]);
    mockBacklogClient.getIssue.mockRejectedValue(new Error('Issue not found'));

    await processAnnotation(mockBacklogClient, mockGitHubClient, annotation, pr, config);

    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to process annotation for PROJ-999')
    );
    expect(mockBacklogClient.updateIssueStatus).not.toHaveBeenCalled();
  });
});
