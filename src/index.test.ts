import * as core from '@actions/core';
import * as github from '@actions/github';
import { BacklogClient } from './backlog';
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
      };
      return inputs[name] || '';
    });

    mockGetBooleanInput.mockReturnValue(false);

    const config = getConfig();

    expect(config.fixStatusId).toBe(3);
    expect(config.closeStatusId).toBe(4);
  });

  it('should parse custom status IDs', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'backlog_host': 'example.backlog.com',
        'backlog_api_key': 'test-api-key',
        'fix_status_id': '5',
        'close_status_id': '6',
      };
      return inputs[name] || '';
    });

    mockGetBooleanInput.mockReturnValue(false);

    const config = getConfig();

    expect(config.fixStatusId).toBe(5);
    expect(config.closeStatusId).toBe(6);
  });

  it('should handle boolean inputs correctly', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'backlog_host': 'example.backlog.com',
        'backlog_api_key': 'test-api-key',
      };
      return inputs[name] || '';
    });

    mockGetBooleanInput.mockImplementation((name: string) => {
      return name === 'add_comment';
    });

    const config = getConfig();

    expect(config.addComment).toBe(true);
    expect(config.updateStatusOnMerge).toBe(false);
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

  it('should handle draft PR', () => {
    const mockContext = {
      payload: {
        pull_request: {
          number: 456,
          title: 'Draft PR',
          body: 'Draft description',
          html_url: 'https://github.com/test/repo/pull/456',
          draft: true,
          merged: false,
        },
      },
    };

    (github.context as any) = mockContext;

    const prInfo = getPullRequestInfo();

    expect(prInfo?.isDraft).toBe(true);
  });

  it('should handle merged PR', () => {
    const mockContext = {
      payload: {
        pull_request: {
          number: 789,
          title: 'Merged PR',
          body: 'Merged description',
          html_url: 'https://github.com/test/repo/pull/789',
          draft: false,
          merged: true,
        },
      },
    };

    (github.context as any) = mockContext;

    const prInfo = getPullRequestInfo();

    expect(prInfo?.merged).toBe(true);
  });

  it('should return null when no PR in context', () => {
    const mockContext = {
      payload: {},
    };

    (github.context as any) = mockContext;

    const prInfo = getPullRequestInfo();

    expect(prInfo).toBeNull();
  });

  it('should handle missing optional fields with defaults', () => {
    const mockContext = {
      payload: {
        pull_request: {
          number: 999,
        },
      },
    };

    (github.context as any) = mockContext;

    const prInfo = getPullRequestInfo();

    expect(prInfo).toEqual({
      number: 999,
      title: '',
      body: '',
      url: '',
      isDraft: false,
      merged: false,
    });
  });
});

describe('handlePullRequestOpened', () => {
  let mockClient: jest.Mocked<BacklogClient>;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
  const mockWarning = core.warning as jest.MockedFunction<typeof core.warning>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      issueExists: jest.fn(),
      addComment: jest.fn(),
      getIssue: jest.fn(),
      updateIssueStatus: jest.fn(),
      getProjectStatuses: jest.fn(),
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

    mockClient.issueExists.mockResolvedValue(true);
    mockClient.addComment.mockResolvedValue({} as any);

    await handlePullRequestOpened(mockClient, pr);

    expect(mockClient.issueExists).toHaveBeenCalledWith('PROJ-123');
    expect(mockClient.addComment).toHaveBeenCalledWith(
      'PROJ-123',
      expect.stringContaining('GitHub Pull Request がオープンされました')
    );
    expect(mockClient.addComment).toHaveBeenCalledWith(
      'PROJ-123',
      expect.stringContaining('https://github.com/test/repo/pull/123')
    );
  });

  it('should handle multiple issue keys', async () => {
    const pr: PullRequestInfo = {
      number: 456,
      title: 'Fix PROJ-123 and PROJ-456',
      body: 'Multiple fixes',
      url: 'https://github.com/test/repo/pull/456',
      isDraft: false,
      merged: false,
    };

    mockClient.issueExists.mockResolvedValue(true);
    mockClient.addComment.mockResolvedValue({} as any);

    await handlePullRequestOpened(mockClient, pr);

    expect(mockClient.issueExists).toHaveBeenCalledTimes(2);
    expect(mockClient.addComment).toHaveBeenCalledTimes(2);
    expect(mockClient.addComment).toHaveBeenCalledWith('PROJ-123', expect.any(String));
    expect(mockClient.addComment).toHaveBeenCalledWith('PROJ-456', expect.any(String));
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

    mockClient.issueExists.mockResolvedValue(false);

    await handlePullRequestOpened(mockClient, pr);

    expect(mockClient.issueExists).toHaveBeenCalledWith('PROJ-999');
    expect(mockClient.addComment).not.toHaveBeenCalled();
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

    await handlePullRequestOpened(mockClient, pr);

    expect(mockClient.issueExists).not.toHaveBeenCalled();
    expect(mockClient.addComment).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('No Backlog issue keys found')
    );
  });

  it('should continue on error for individual issues', async () => {
    const pr: PullRequestInfo = {
      number: 222,
      title: 'Fix PROJ-111 and PROJ-222',
      body: 'Test',
      url: 'https://github.com/test/repo/pull/222',
      isDraft: false,
      merged: false,
    };

    mockClient.issueExists.mockResolvedValue(true);
    mockClient.addComment
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({} as any);

    await handlePullRequestOpened(mockClient, pr);

    expect(mockClient.addComment).toHaveBeenCalledTimes(2);
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to add comment to PROJ-111')
    );
  });
});

describe('handlePullRequestMerged', () => {
  let mockClient: jest.Mocked<BacklogClient>;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      issueExists: jest.fn(),
      addComment: jest.fn(),
      getIssue: jest.fn(),
      updateIssueStatus: jest.fn(),
      getProjectStatuses: jest.fn(),
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
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockClient.getIssue.mockResolvedValue({
      id: 1,
      issueKey: 'PROJ-123',
      summary: 'Test issue',
    } as any);
    mockClient.updateIssueStatus.mockResolvedValue({} as any);
    mockClient.addComment.mockResolvedValue({} as any);

    await handlePullRequestMerged(mockClient, pr, config);

    expect(mockClient.getIssue).toHaveBeenCalledWith('PROJ-123');
    expect(mockClient.updateIssueStatus).toHaveBeenCalledWith('PROJ-123', 3);
    expect(mockClient.addComment).toHaveBeenCalledWith(
      'PROJ-123',
      expect.stringContaining('処理済み')
    );
  });

  it('should process close annotations', async () => {
    const pr: PullRequestInfo = {
      number: 456,
      title: 'closes PROJ-456',
      body: 'Closing the issue',
      url: 'https://github.com/test/repo/pull/456',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockClient.getIssue.mockResolvedValue({
      id: 2,
      issueKey: 'PROJ-456',
      summary: 'Test issue 2',
    } as any);
    mockClient.updateIssueStatus.mockResolvedValue({} as any);
    mockClient.addComment.mockResolvedValue({} as any);

    await handlePullRequestMerged(mockClient, pr, config);

    expect(mockClient.updateIssueStatus).toHaveBeenCalledWith('PROJ-456', 4);
    expect(mockClient.addComment).toHaveBeenCalledWith(
      'PROJ-456',
      expect.stringContaining('完了')
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
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    await handlePullRequestMerged(mockClient, pr, config);

    expect(mockClient.getIssue).not.toHaveBeenCalled();
    expect(mockClient.updateIssueStatus).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('No action annotations found')
    );
  });

  it('should process multiple annotations', async () => {
    const pr: PullRequestInfo = {
      number: 999,
      title: 'fixes PROJ-111',
      body: 'closes PROJ-222',
      url: 'https://github.com/test/repo/pull/999',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockClient.getIssue.mockResolvedValue({} as any);
    mockClient.updateIssueStatus.mockResolvedValue({} as any);
    mockClient.addComment.mockResolvedValue({} as any);

    await handlePullRequestMerged(mockClient, pr, config);

    expect(mockClient.getIssue).toHaveBeenCalledTimes(2);
    expect(mockClient.updateIssueStatus).toHaveBeenCalledTimes(2);
  });
});

describe('processAnnotation', () => {
  let mockClient: jest.Mocked<BacklogClient>;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
  const mockError = core.error as jest.MockedFunction<typeof core.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      issueExists: jest.fn(),
      addComment: jest.fn(),
      getIssue: jest.fn(),
      updateIssueStatus: jest.fn(),
      getProjectStatuses: jest.fn(),
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
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockClient.getIssue.mockResolvedValue({
      id: 1,
      issueKey: 'PROJ-123',
      summary: 'Test issue',
    } as any);
    mockClient.updateIssueStatus.mockResolvedValue({} as any);
    mockClient.addComment.mockResolvedValue({} as any);

    await processAnnotation(mockClient, annotation, pr, config);

    expect(mockClient.updateIssueStatus).toHaveBeenCalledWith('PROJ-123', 3);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('処理済み')
    );
  });

  it('should update status for close action', async () => {
    const annotation: ParsedAnnotation = {
      issueKey: 'PROJ-456',
      action: 'close',
      originalText: 'closes PROJ-456',
    };

    const pr: PullRequestInfo = {
      number: 456,
      title: 'Test',
      body: '',
      url: 'https://github.com/test/repo/pull/456',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockClient.getIssue.mockResolvedValue({
      id: 2,
      issueKey: 'PROJ-456',
      summary: 'Test issue 2',
    } as any);
    mockClient.updateIssueStatus.mockResolvedValue({} as any);
    mockClient.addComment.mockResolvedValue({} as any);

    await processAnnotation(mockClient, annotation, pr, config);

    expect(mockClient.updateIssueStatus).toHaveBeenCalledWith('PROJ-456', 4);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('完了')
    );
  });

  it('should add comment after updating status', async () => {
    const annotation: ParsedAnnotation = {
      issueKey: 'PROJ-789',
      action: 'fix',
      originalText: 'fixes PROJ-789',
    };

    const pr: PullRequestInfo = {
      number: 789,
      title: 'Test',
      body: '',
      url: 'https://github.com/test/repo/pull/789',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockClient.getIssue.mockResolvedValue({
      id: 3,
      issueKey: 'PROJ-789',
      summary: 'Test issue 3',
    } as any);
    mockClient.updateIssueStatus.mockResolvedValue({} as any);
    mockClient.addComment.mockResolvedValue({} as any);

    await processAnnotation(mockClient, annotation, pr, config);

    expect(mockClient.addComment).toHaveBeenCalledWith(
      'PROJ-789',
      expect.stringContaining('GitHub Pull Request がマージされました')
    );
    expect(mockClient.addComment).toHaveBeenCalledWith(
      'PROJ-789',
      expect.stringContaining(pr.url)
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
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 3,
      closeStatusId: 4,
    };

    mockClient.getIssue.mockRejectedValue(new Error('Issue not found'));

    await processAnnotation(mockClient, annotation, pr, config);

    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to process annotation for PROJ-999')
    );
    expect(mockClient.updateIssueStatus).not.toHaveBeenCalled();
  });

  it('should use custom status IDs from config', async () => {
    const annotation: ParsedAnnotation = {
      issueKey: 'PROJ-111',
      action: 'fix',
      originalText: 'fixes PROJ-111',
    };

    const pr: PullRequestInfo = {
      number: 111,
      title: 'Test',
      body: '',
      url: 'https://github.com/test/repo/pull/111',
      isDraft: false,
      merged: true,
    };

    const config: ActionConfig = {
      backlog: { host: 'example.backlog.com', apiKey: 'test' },
      addComment: true,
      updateStatusOnMerge: true,
      fixStatusId: 10,
      closeStatusId: 20,
    };

    mockClient.getIssue.mockResolvedValue({
      id: 4,
      issueKey: 'PROJ-111',
      summary: 'Custom status test',
    } as any);
    mockClient.updateIssueStatus.mockResolvedValue({} as any);
    mockClient.addComment.mockResolvedValue({} as any);

    await processAnnotation(mockClient, annotation, pr, config);

    expect(mockClient.updateIssueStatus).toHaveBeenCalledWith('PROJ-111', 10);
  });
});
