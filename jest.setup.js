import '@testing-library/jest-dom'

// Add polyfills for Node.js compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Add setImmediate polyfill
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => setTimeout(callback, 0, ...args)
  global.clearImmediate = (id) => clearTimeout(id)
}

// Mock Next.js router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
}

jest.mock('next/navigation', () => {
  const mockSearchParams = {
    get: jest.fn(() => null),
    getAll: jest.fn(() => []),
    has: jest.fn(() => false),
    keys: jest.fn(() => []),
    values: jest.fn(() => []),
    entries: jest.fn(() => []),
    forEach: jest.fn(),
    toString: jest.fn(() => ''),
    [Symbol.iterator]: jest.fn(() => [][Symbol.iterator]()),
  };

  return {
    useRouter: () => mockRouter,
    usePathname: () => '/test',
    useSearchParams: jest.fn(() => mockSearchParams),
    useParams: () => ({}),
  };
})

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />
  },
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Suppress console warnings in tests
const originalWarn = console.warn
const originalError = console.error

beforeAll(() => {
  console.warn = (...args) => {
    if (
      args[0]?.includes?.('Warning: ReactDOM.render is deprecated') ||
      args[0]?.includes?.('Warning: `ReactDOMTestUtils.act`')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }

  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning: ReactDOM.render is deprecated') ||
      args[0]?.includes?.('Error: Not implemented: navigation')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalWarn
  console.error = originalError
})

// Add cleanup for database connections
afterAll(async () => {
  // Give time for any async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Force close any remaining connections
  if (global.gc) {
    global.gc();
  }
}); 