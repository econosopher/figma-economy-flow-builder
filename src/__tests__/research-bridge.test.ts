import { 
  generateResearchCache, 
  generateEconomyJSON,
  createResearchMarkdown,
  parseResearchOutput 
} from '../research-bridge';

// Mock fetch for testing
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('Research Bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateResearchCache', () => {
    it('should generate cache from API', async () => {
      const mockResponse = {
        success: true,
        cache: {
          game: 'Test Game',
          depth: 2,
          timestamp: '2025-01-01T00:00:00Z',
          prompt_version: '1.0',
          instructions: 'Research the economy of Test Game at depth level 2',
          categories: ['Core Gameplay Loop', 'Resource Management']
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateResearchCache({
        gameName: 'Test Game',
        depth: 2
      });

      expect(result).toEqual(mockResponse.cache);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/research/cache',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameName: 'Test Game', depth: 2 })
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const result = await generateResearchCache({
        gameName: 'Test Game',
        depth: 1
      });

      // Should return fallback cache
      expect(result.game).toBe('Test Game');
      expect(result.depth).toBe(1);
      expect(result.prompt_version).toBe('1.0');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await generateResearchCache({
        gameName: 'Test Game',
        depth: 3
      });

      // Should return fallback cache
      expect(result.game).toBe('Test Game');
      expect(result.depth).toBe(3);
      expect(result.instructions).toContain('Comprehensive analysis');
    });
  });

  describe('generateEconomyJSON', () => {
    it('should generate economy JSON from API and repair it', async () => {
      const mockEconomy = {
        name: 'Test Game',
        inputs: [
          { id: 'time', label: 'Time', kind: 'initial_sink_node' }
        ],
        nodes: [
          {
            id: 'play',
            label: 'To Play',
            sources: ['XP'],
            sinks: ['Energy'],
            values: []
          }
        ],
        edges: [['time', 'play']]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, json: mockEconomy })
      });

      const result = await generateEconomyJSON({
        gameName: 'Test Game',
        depth: 2,
        provider: 'gemini',
        apiKey: 'test-key'
      });

      // repairEconomyJSON adds 'kind' to nodes and 'subsections' array
      expect(result).toEqual({
        name: 'Test Game',
        inputs: [
          { id: 'time', label: 'Time', kind: 'initial_sink_node' }
        ],
        nodes: [
          {
            id: 'play',
            label: 'To Play',
            sources: ['XP'],
            sinks: ['Energy'],
            values: [],
            kind: 'node'
          }
        ],
        edges: [['time', 'play']],
        subsections: []
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/research/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            gameName: 'Test Game',
            depth: 2,
            provider: 'gemini',
            apiKey: 'test-key'
          })
        })
      );
    });

    it('should throw an error on API failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      await expect(
        generateEconomyJSON({
          gameName: 'Failed Game',
          depth: 1,
          apiKey: 'test-api-key'
        })
      ).rejects.toThrow('Failed to generate economy JSON');
    });
  });

  describe('createResearchMarkdown', () => {
    it('should create markdown for depth 1', () => {
      const markdown = createResearchMarkdown('Test Game', 1);
      
      expect(markdown).toContain('# Test Game Economy Research');
      expect(markdown).toContain('Research depth: Level 1');
      expect(markdown).toContain('### Core Systems');
      expect(markdown).toContain('Primary currencies and resources');
      expect(markdown).not.toContain('### Detailed Flows');
      expect(markdown).not.toContain('### Comprehensive Analysis');
    });

    it('should create markdown for depth 2', () => {
      const markdown = createResearchMarkdown('Test Game', 2);
      
      expect(markdown).toContain('### Core Systems');
      expect(markdown).toContain('### Detailed Flows');
      expect(markdown).toContain('Resource conversion mechanics');
      expect(markdown).not.toContain('### Comprehensive Analysis');
    });

    it('should create markdown for depth 3', () => {
      const markdown = createResearchMarkdown('Test Game', 3);
      
      expect(markdown).toContain('### Core Systems');
      expect(markdown).toContain('### Detailed Flows');
      expect(markdown).toContain('### Comprehensive Analysis');
      expect(markdown).toContain('Player segmentation');
      expect(markdown).toContain('Monetization drivers');
    });

    it('should include appropriate categories based on depth', () => {
      const markdown1 = createResearchMarkdown('Game', 1);
      const markdown2 = createResearchMarkdown('Game', 2);
      const markdown3 = createResearchMarkdown('Game', 3);
      
      // Depth 1 has fewer categories
      expect(markdown1.match(/- /g)?.length).toBeLessThan(
        markdown2.match(/- /g)?.length || 0
      );
      
      // Depth 3 has most categories
      expect(markdown3.match(/- /g)?.length).toBeGreaterThan(
        markdown2.match(/- /g)?.length || 0
      );
    });
  });

  describe('parseResearchOutput', () => {
    it('should parse JSON from output string', () => {
      const output = 'Some text before {"key": "value", "number": 42} some text after';
      const result = parseResearchOutput(output);
      
      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should parse clean JSON', () => {
      const output = '{"name": "Test", "items": [1, 2, 3]}';
      const result = parseResearchOutput(output);
      
      expect(result).toEqual({ name: 'Test', items: [1, 2, 3] });
    });

    it('should throw on invalid JSON', () => {
      const output = 'This is not JSON at all';
      
      expect(() => parseResearchOutput(output)).toThrow(
        'Could not parse research output as JSON'
      );
    });

    it('should extract nested JSON objects', () => {
      const output = `
        Log output here
        Processing...
        {
          "inputs": [],
          "nodes": [],
          "edges": []
        }
        Done!
      `;
      const result = parseResearchOutput(output);
      
      expect(result).toHaveProperty('inputs');
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
    });
  });
});
