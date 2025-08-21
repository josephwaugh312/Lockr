// Mock userRepository to prevent database calls in tests
const userRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  verifyEmail: jest.fn(),
  updatePassword: jest.fn(),
  updateLastLogin: jest.fn(),
};

module.exports = userRepository;