import * as github from '@actions/github';
import { GitHubClient, buildBacklogIssueUrl } from './github';

// Mock @actions/github
jest.mock('@actions/github');

describe('buildBacklogIssueUrl', () => {
  it('should build correct URL', () => {
    const url = buildBacklogIssueUrl('example.backlog.com', 'PROJ-123');
    expect(url).toBe('https://example.backlog.com/view/PROJ-123');
  });

  it('should strip protocol from host', () => {
    const url = buildBacklogIssueUrl('https://example.backlog.com', 'PROJ-456');
    expect(url).toBe('https://example.backlog.com/view/PROJ-456');
  });

  it('should handle http protocol', () => {
    const url = buildBacklogIssueUrl('http://example.backlog.jp', 'TEST-1');
    expect(url).toBe('https://example.backlog.jp/view/TEST-1');
  });
});

describe('GitHubClient', () => {
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = {
      rest: {
        issues: {
          listComments: jest.fn(),
          createComment: jest.fn(),
        },
      },
    };

    (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);
    (github.context as any) = {
      repo: {
        owner: 'test-owner',
        repo: 'test-repo',
      },
    };
  });

  describe('getPRComments', () => {
    it('should fetch PR comments', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          { id: 1, body: 'Comment 1' },
          { id: 2, body: 'Comment 2' },
        ],
      });

      const client = new GitHubClient('test-token');
      const comments = await client.getPRComments(123);

      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
      });
      expect(comments).toEqual([
        { id: 1, body: 'Comment 1' },
        { id: 2, body: 'Comment 2' },
      ]);
    });

    it('should handle empty body', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [{ id: 1, body: null }],
      });

      const client = new GitHubClient('test-token');
      const comments = await client.getPRComments(123);

      expect(comments).toEqual([{ id: 1, body: '' }]);
    });
  });

  describe('addPRComment', () => {
    it('should add comment to PR', async () => {
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const client = new GitHubClient('test-token');
      await client.addPRComment(123, 'Test comment');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: 'Test comment',
      });
    });
  });

  describe('hasBacklogComment', () => {
    it('should return true if Backlog URL comment exists', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          { id: 1, body: 'Some comment' },
          { id: 2, body: 'Backlog: [PROJ-123](https://example.backlog.com/view/PROJ-123)' },
        ],
      });

      const client = new GitHubClient('test-token');
      const result = await client.hasBacklogComment(123, 'example.backlog.com', 'PROJ-123');

      expect(result).toBe(true);
    });

    it('should return false if no Backlog URL comment exists', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          { id: 1, body: 'Some comment' },
          { id: 2, body: 'Another comment' },
        ],
      });

      const client = new GitHubClient('test-token');
      const result = await client.hasBacklogComment(123, 'example.backlog.com', 'PROJ-123');

      expect(result).toBe(false);
    });

    it('should return false for different issue key', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          { id: 1, body: 'Backlog: [PROJ-456](https://example.backlog.com/view/PROJ-456)' },
        ],
      });

      const client = new GitHubClient('test-token');
      const result = await client.hasBacklogComment(123, 'example.backlog.com', 'PROJ-123');

      expect(result).toBe(false);
    });
  });

  describe('addBacklogLinkComment', () => {
    it('should add Backlog link comment if not exists', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [],
      });
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      const client = new GitHubClient('test-token');
      const result = await client.addBacklogLinkComment(123, 'example.backlog.com', 'PROJ-123');

      expect(result).toBe(true);
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: 'Backlog: [PROJ-123](https://example.backlog.com/view/PROJ-123)',
      });
    });

    it('should not add comment if already exists', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          { id: 1, body: 'Backlog: [PROJ-123](https://example.backlog.com/view/PROJ-123)' },
        ],
      });

      const client = new GitHubClient('test-token');
      const result = await client.addBacklogLinkComment(123, 'example.backlog.com', 'PROJ-123');

      expect(result).toBe(false);
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });
  });
});
