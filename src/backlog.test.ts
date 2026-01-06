import { Backlog } from 'backlog-js';
import { BacklogClient } from './backlog';

// Mock backlog-js module
jest.mock('backlog-js');

const MockedBacklog = Backlog as jest.MockedClass<typeof Backlog>;

describe('BacklogClient', () => {
  let mockBacklogInstance: jest.Mocked<Backlog>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instance
    mockBacklogInstance = {
      getIssue: jest.fn(),
      postIssueComments: jest.fn(),
      patchIssue: jest.fn(),
      getProjectStatuses: jest.fn(),
    } as unknown as jest.Mocked<Backlog>;

    // Make constructor return our mock instance
    MockedBacklog.mockImplementation(() => mockBacklogInstance);
  });

  describe('constructor', () => {
    it('should create Backlog client with correct config', () => {
      new BacklogClient({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });

      expect(MockedBacklog).toHaveBeenCalledWith({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });
    });

    it('should strip protocol from host', () => {
      new BacklogClient({
        host: 'https://example.backlog.com',
        apiKey: 'test-api-key',
      });

      expect(MockedBacklog).toHaveBeenCalledWith({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });
    });

    it('should strip http protocol from host', () => {
      new BacklogClient({
        host: 'http://example.backlog.jp',
        apiKey: 'test-api-key',
      });

      expect(MockedBacklog).toHaveBeenCalledWith({
        host: 'example.backlog.jp',
        apiKey: 'test-api-key',
      });
    });
  });

  describe('getIssue', () => {
    it('should call backlog-js getIssue', async () => {
      const mockIssue = {
        id: 1,
        issueKey: 'PROJ-123',
        summary: 'Test issue',
      };
      mockBacklogInstance.getIssue.mockResolvedValue(mockIssue as any);

      const client = new BacklogClient({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });

      const result = await client.getIssue('PROJ-123');

      expect(mockBacklogInstance.getIssue).toHaveBeenCalledWith('PROJ-123');
      expect(result).toEqual(mockIssue);
    });
  });

  describe('addComment', () => {
    it('should call backlog-js postIssueComments', async () => {
      const mockComment = {
        id: 1,
        content: 'Test comment',
      };
      mockBacklogInstance.postIssueComments.mockResolvedValue(mockComment as any);

      const client = new BacklogClient({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });

      const result = await client.addComment('PROJ-123', 'Test comment');

      expect(mockBacklogInstance.postIssueComments).toHaveBeenCalledWith('PROJ-123', {
        content: 'Test comment',
      });
      expect(result).toEqual(mockComment);
    });
  });

  describe('updateIssueStatus', () => {
    it('should call backlog-js patchIssue with statusId', async () => {
      const mockIssue = {
        id: 1,
        issueKey: 'PROJ-123',
        status: { id: 3 },
      };
      mockBacklogInstance.patchIssue.mockResolvedValue(mockIssue as any);

      const client = new BacklogClient({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });

      const result = await client.updateIssueStatus('PROJ-123', 3);

      expect(mockBacklogInstance.patchIssue).toHaveBeenCalledWith('PROJ-123', {
        statusId: 3,
      });
      expect(result).toEqual(mockIssue);
    });
  });

  describe('getProjectStatuses', () => {
    it('should call backlog-js getProjectStatuses', async () => {
      const mockStatuses = [
        { id: 1, name: '未対応' },
        { id: 2, name: '処理中' },
        { id: 3, name: '処理済み' },
        { id: 4, name: '完了' },
      ];
      mockBacklogInstance.getProjectStatuses.mockResolvedValue(mockStatuses as any);

      const client = new BacklogClient({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });

      const result = await client.getProjectStatuses('PROJ');

      expect(mockBacklogInstance.getProjectStatuses).toHaveBeenCalledWith('PROJ');
      expect(result).toEqual(mockStatuses);
    });

    it('should accept numeric project ID', async () => {
      mockBacklogInstance.getProjectStatuses.mockResolvedValue([] as any);

      const client = new BacklogClient({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });

      await client.getProjectStatuses(12345);

      expect(mockBacklogInstance.getProjectStatuses).toHaveBeenCalledWith(12345);
    });
  });

  describe('issueExists', () => {
    it('should return true when issue exists', async () => {
      mockBacklogInstance.getIssue.mockResolvedValue({ id: 1 } as any);

      const client = new BacklogClient({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });

      const result = await client.issueExists('PROJ-123');

      expect(result).toBe(true);
      expect(mockBacklogInstance.getIssue).toHaveBeenCalledWith('PROJ-123');
    });

    it('should return false when issue does not exist', async () => {
      mockBacklogInstance.getIssue.mockRejectedValue(new Error('Not found'));

      const client = new BacklogClient({
        host: 'example.backlog.com',
        apiKey: 'test-api-key',
      });

      const result = await client.issueExists('PROJ-999');

      expect(result).toBe(false);
    });
  });
});
