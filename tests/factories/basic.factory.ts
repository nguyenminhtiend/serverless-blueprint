// Simple factory example for Phase 3
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  ...overrides,
});

export const createMockRequest = (overrides: Partial<any> = {}) => ({
  method: 'GET',
  url: '/api/test',
  headers: {},
  body: null,
  ...overrides,
});
