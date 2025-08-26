// Setup file for Jest tests

// Keep console output for debugging
// const originalConsole = console;
// (global as any).console = {
//   ...originalConsole,
//   log: jest.fn(),
//   warn: jest.fn(),
//   // Keep error and debug for debugging
//   error: originalConsole.error,
//   debug: originalConsole.debug,
// };

// Add a simple test to prevent Jest from complaining
describe('Setup', () => {
  it('should be defined', () => {
    expect(true).toBe(true);
  });
});