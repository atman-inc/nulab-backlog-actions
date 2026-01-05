import { parseAnnotations, extractIssueKeys } from './parser';

describe('parseAnnotations', () => {
  it('should parse fix annotations', () => {
    const result = parseAnnotations('fixes PROJ-123');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      issueKey: 'PROJ-123',
      action: 'fix',
      originalText: 'fixes PROJ-123',
    });
  });

  it('should parse close annotations', () => {
    const result = parseAnnotations('closes PROJ-456');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      issueKey: 'PROJ-456',
      action: 'close',
      originalText: 'closes PROJ-456',
    });
  });

  it('should parse resolve annotations as fix', () => {
    const result = parseAnnotations('resolves PROJ-789');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      issueKey: 'PROJ-789',
      action: 'fix',
      originalText: 'resolves PROJ-789',
    });
  });

  it('should handle colon format', () => {
    const result = parseAnnotations('fix: PROJ-123');
    expect(result).toHaveLength(1);
    expect(result[0].issueKey).toBe('PROJ-123');
  });

  it('should handle hash format', () => {
    const result = parseAnnotations('fixes #PROJ-123');
    expect(result).toHaveLength(1);
    expect(result[0].issueKey).toBe('PROJ-123');
  });

  it('should parse multiple annotations', () => {
    const result = parseAnnotations('fixes PROJ-123\ncloses PROJ-456');
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('fix');
    expect(result[1].action).toBe('close');
  });

  it('should deduplicate same issue keys', () => {
    const result = parseAnnotations('fixes PROJ-123\nresolves PROJ-123');
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('fix');
  });

  it('should be case insensitive for keywords', () => {
    const result = parseAnnotations('FIXES PROJ-123');
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('fix');
  });

  it('should normalize issue keys to uppercase', () => {
    const result = parseAnnotations('fixes proj-123');
    expect(result).toHaveLength(1);
    expect(result[0].issueKey).toBe('PROJ-123');
  });

  it('should handle empty string', () => {
    const result = parseAnnotations('');
    expect(result).toHaveLength(0);
  });

  it('should handle text without annotations', () => {
    const result = parseAnnotations('This is a normal PR description');
    expect(result).toHaveLength(0);
  });

  it('should handle underscore in project key', () => {
    const result = parseAnnotations('fixes MY_PROJECT-123');
    expect(result).toHaveLength(1);
    expect(result[0].issueKey).toBe('MY_PROJECT-123');
  });

  it('should handle all fix variants', () => {
    const variants = ['fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved'];
    for (const variant of variants) {
      const result = parseAnnotations(`${variant} PROJ-1`);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('fix');
    }
  });

  it('should handle all close variants', () => {
    const variants = ['close', 'closes', 'closed'];
    for (const variant of variants) {
      const result = parseAnnotations(`${variant} PROJ-1`);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('close');
    }
  });
});

describe('extractIssueKeys', () => {
  it('should extract issue keys from text', () => {
    const result = extractIssueKeys('This PR fixes PROJ-123 and PROJ-456');
    expect(result).toHaveLength(2);
    expect(result).toContain('PROJ-123');
    expect(result).toContain('PROJ-456');
  });

  it('should deduplicate issue keys', () => {
    const result = extractIssueKeys('PROJ-123 and also PROJ-123');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('PROJ-123');
  });

  it('should handle empty string', () => {
    const result = extractIssueKeys('');
    expect(result).toHaveLength(0);
  });

  it('should normalize to uppercase', () => {
    const result = extractIssueKeys('proj-123');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('PROJ-123');
  });
});
