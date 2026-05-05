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
      expect(result.prompt_version).toBe('2.0');
      expect(result.instructions).toContain('Research the economy and progression systems');
      expect(result.conversion_prompt).toContain('Output requirements:');
      expect(result.json_schema).toBeDefined();
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
      expect(result.instructions).toContain('monetization');
    });
  });

  describe('generateEconomyJSON', () => {
    it('should generate economy JSON from API and repair it', async () => {
      const mockEconomy = {
        name: 'Test Game',
        stages: [
          { id: 'inputs', label: 'Inputs' },
          { id: 'actions', label: 'Actions' },
          { id: 'outcomes', label: 'Outcomes' }
        ],
        lanes: [
          { id: 'core', label: 'Core' }
        ],
        nodes: [
          { id: 'time', label: 'Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core', sources: [], sinks: [], values: [] },
          {
            id: 'play',
            label: 'To Play',
            stageId: 'actions',
            laneId: 'core',
            sources: ['XP'],
            sinks: ['Energy'],
            values: []
          },
          {
            id: 'win',
            label: 'Win',
            kind: 'final_good',
            stageId: 'outcomes',
            laneId: 'core',
            sources: [],
            sinks: [],
            values: []
          }
        ],
        edges: [{ from: 'time', to: 'play' }, { from: 'play', to: 'win', type: 'final' }]
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

      expect(result).toEqual({
        schemaVersion: 2,
        name: 'Test Game',
        stages: [
          { id: 'inputs', label: 'Inputs' },
          { id: 'actions', label: 'Actions' },
          { id: 'outcomes', label: 'Outcomes' }
        ],
        lanes: [
          { id: 'core', label: 'Core' }
        ],
        nodes: [
          { id: 'time', label: 'Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core', sources: [], sinks: [], values: [] },
          {
            id: 'play',
            label: 'To Play',
            stageId: 'actions',
            laneId: 'core',
            sources: ['XP'],
            sinks: ['Energy'],
            values: [],
            kind: 'action'
          },
          {
            id: 'win',
            label: 'Win',
            stageId: 'outcomes',
            laneId: 'core',
            sources: [],
            sinks: [],
            values: [],
            kind: 'final_good'
          }
        ],
        edges: [{ from: 'time', to: 'play' }, { from: 'play', to: 'win', type: 'final' }]
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/research/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
      const [, request] = mockFetch.mock.calls[0];
      const parsedBody = JSON.parse(request.body);
      expect(parsedBody.gameName).toBe('Test Game');
      expect(parsedBody.depth).toBe(2);
      expect(parsedBody.provider).toBe('gemini');
      expect(parsedBody.apiKey).toBe('test-key');
      expect(parsedBody.promptVersion).toBe('2.0');
      expect(parsedBody.conversionPrompt).toContain('Always set "schemaVersion": 2');
      expect(parsedBody.responseJsonSchema).toBeDefined();
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
      expect(markdown).toContain('## Research Brief');
      expect(markdown).toContain('## Structured Conversion Prompt');
      expect(markdown).toContain('## Output JSON Schema');
    });

    it('should create markdown for depth 2', () => {
      const markdown = createResearchMarkdown('Test Game', 2);
      
      expect(markdown).toContain('crafting, trading, events');
      expect(markdown).toContain('Output requirements:');
    });

    it('should create markdown for depth 3', () => {
      const markdown = createResearchMarkdown('Test Game', 3);
      
      expect(markdown).toContain('monetization');
      expect(markdown).toContain('If your research workflow used Gemini Deep Research');
    });

    it('should include appropriate categories based on depth', () => {
      const markdown1 = createResearchMarkdown('Game', 1);
      const markdown2 = createResearchMarkdown('Game', 2);
      const markdown3 = createResearchMarkdown('Game', 3);
      
      expect(markdown1.length).toBeLessThan(markdown2.length);
      expect(markdown3.length).toBeGreaterThan(markdown2.length);
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
          "stages": [],
          "nodes": [],
          "edges": []
        }
        Done!
      `;
      const result = parseResearchOutput(output);
      
      expect(result).toHaveProperty('stages');
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
    });

    it('should parse JSON inside markdown code fences', () => {
      const output = [
        'Here is the JSON:',
        '```json',
        '{ "stages": [], "nodes": [], "edges": [] }',
        '```'
      ].join('\n');
      const result = parseResearchOutput(output);
      expect(result).toEqual({ stages: [], nodes: [], edges: [] });
    });

    it('should skip non-JSON braces before the real JSON', () => {
      const output = 'Log line {not json} ... then {"key":"value"}';
      const result = parseResearchOutput(output);
      expect(result).toEqual({ key: 'value' });
    });
  });
});
