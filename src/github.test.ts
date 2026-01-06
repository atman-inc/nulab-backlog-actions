import * as github from '@actions/github';
import {
  GitHubClient,
  buildBacklogIssueUrl,
  buildBacklogLinkMarker,
  buildMergeMarker,
} from './github';

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

describe('buildBacklogLinkMarker', () => {
  it('should build correct marker', () => {
    const marker = buildBacklogLinkMarker('PROJ-123');
    expect(marker).toBe('<!-- backlog-link:PROJ-123 -->');
  });
});

describe('buildMergeMarker', () => {
  it('should build correct marker', () => {
    const marker = buildMergeMarker('PROJ-456');
    expect(marker).toBe('<!-- backlog-merged:PROJ-456 -->');
  });
});

describe('GitHubClient', () => {
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = {
      rest: {
        pulls: {
          get: jest.fn(),
          update: jest.fn(),
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

  describe('getPRBody', () => {
    it('should fetch PR body', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'PR description content' },
      });

      const client = new GitHubClient('test-token');
      const body = await client.getPRBody(123);

      expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
      });
      expect(body).toBe('PR description content');
    });

    it('should handle null body', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: null },
      });

      const client = new GitHubClient('test-token');
      const body = await client.getPRBody(123);

      expect(body).toBe('');
    });
  });

  describe('updatePRBody', () => {
    it('should update PR body', async () => {
      mockOctokit.rest.pulls.update.mockResolvedValue({});

      const client = new GitHubClient('test-token');
      await client.updatePRBody(123, 'New body content');

      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        body: 'New body content',
      });
    });
  });

  describe('hasBacklogLink', () => {
    it('should return true if marker exists', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'Some content\n<!-- backlog-link:PROJ-123 -->\nMore content' },
      });

      const client = new GitHubClient('test-token');
      const result = await client.hasBacklogLink(123, 'PROJ-123');

      expect(result).toBe(true);
    });

    it('should return false if marker does not exist', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'Some content without marker' },
      });

      const client = new GitHubClient('test-token');
      const result = await client.hasBacklogLink(123, 'PROJ-123');

      expect(result).toBe(false);
    });

    it('should return false for different issue key', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: '<!-- backlog-link:PROJ-456 -->' },
      });

      const client = new GitHubClient('test-token');
      const result = await client.hasBacklogLink(123, 'PROJ-123');

      expect(result).toBe(false);
    });
  });

  describe('addBacklogLinkToDescription', () => {
    it('should add link if not exists', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'Original description' },
      });
      mockOctokit.rest.pulls.update.mockResolvedValue({});

      const client = new GitHubClient('test-token');
      const result = await client.addBacklogLinkToDescription(123, 'example.backlog.com', 'PROJ-123');

      expect(result).toBe(true);
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        body: expect.stringContaining('Original description'),
      });
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        body: expect.stringContaining('https://example.backlog.com/view/PROJ-123'),
      });
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        body: expect.stringContaining('<!-- backlog-link:PROJ-123 -->'),
      });
    });

    it('should not add if already exists', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'Description\n<!-- backlog-link:PROJ-123 -->' },
      });

      const client = new GitHubClient('test-token');
      const result = await client.addBacklogLinkToDescription(123, 'example.backlog.com', 'PROJ-123');

      expect(result).toBe(false);
      expect(mockOctokit.rest.pulls.update).not.toHaveBeenCalled();
    });
  });

  describe('hasMergeMarker', () => {
    it('should return true if merge marker exists', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'Content\n<!-- backlog-merged:PROJ-123 -->' },
      });

      const client = new GitHubClient('test-token');
      const result = await client.hasMergeMarker(123, 'PROJ-123');

      expect(result).toBe(true);
    });

    it('should return false if merge marker does not exist', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'Content without marker' },
      });

      const client = new GitHubClient('test-token');
      const result = await client.hasMergeMarker(123, 'PROJ-123');

      expect(result).toBe(false);
    });
  });

  describe('addMergeMarkerToDescription', () => {
    it('should add merge marker if not exists', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'Original description' },
      });
      mockOctokit.rest.pulls.update.mockResolvedValue({});

      const client = new GitHubClient('test-token');
      await client.addMergeMarkerToDescription(123, 'example.backlog.com', 'PROJ-123', '処理済み');

      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        body: expect.stringContaining('<!-- backlog-merged:PROJ-123 -->'),
      });
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        body: expect.stringContaining('処理済み'),
      });
    });

    it('should not add if already exists', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { body: 'Description\n<!-- backlog-merged:PROJ-123 -->' },
      });

      const client = new GitHubClient('test-token');
      await client.addMergeMarkerToDescription(123, 'example.backlog.com', 'PROJ-123', '処理済み');

      expect(mockOctokit.rest.pulls.update).not.toHaveBeenCalled();
    });
  });
});
