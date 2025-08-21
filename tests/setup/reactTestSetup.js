// React Testing Library Setup for Component Tests
import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// Configure React Testing Library
configure({
  asyncUtilTimeout: 3000,
  computedStyleSupportsPseudoElements: true
})

// Polyfill/override getComputedStyle to avoid jsdom "Not implemented" errors
// (dom-accessibility-api may call with a pseudo-element argument)
// Provide a minimal stub sufficient for accessibility name computation
const gcStyleStub = () => ({
  getPropertyValue: () => '',
  content: '',
  display: 'block',
})
if (typeof window !== 'undefined' && window) {
  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    writable: true,
    value: (_elt, _pseudo) => gcStyleStub(),
  })
}

// Add TextEncoder/TextDecoder polyfills
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Provide localStorage/sessionStorage polyfills for Node test environments
const createMemoryStorage = () => {
  let store = {}
  return {
    get length() {
      return Object.keys(store).length
    },
    clear() {
      store = {}
    },
    getItem(key) {
      const k = String(key)
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null
    },
    setItem(key, value) {
      store[String(key)] = String(value)
    },
    removeItem(key) {
      delete store[String(key)]
    },
    key(index) {
      const keys = Object.keys(store)
      return keys[index] ?? null
    },
  }
}

if (typeof global.localStorage === 'undefined') {
  // @ts-ignore
  global.localStorage = createMemoryStorage()
}

if (typeof global.sessionStorage === 'undefined') {
  // @ts-ignore
  global.sessionStorage = createMemoryStorage()
}

// Add setImmediate polyfill
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => setTimeout(callback, 0, ...args)
  global.clearImmediate = (id) => clearTimeout(id)
}

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
})

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn().mockReturnValue([]),
  root: null,
  rootMargin: '',
  thresholds: [],
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
if (typeof window !== 'undefined' && window) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock window.scrollTo
if (typeof window !== 'undefined' && window) {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  })
}

// Mock fetch
global.fetch = jest.fn()

// Suppress specific console warnings
const originalWarn = console.warn
const originalError = console.error

beforeAll(() => {
  console.warn = (...args) => {
    if (
      args[0]?.includes?.('ReactDOM.render') ||
      args[0]?.includes?.('ReactDOMTestUtils.act') ||
      args[0]?.includes?.('An update to') ||
      args[0]?.includes?.('When testing, code that causes React state updates')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }

  console.error = (...args) => {
    if (
      args[0]?.includes?.('ReactDOM.render') ||
      args[0]?.includes?.('Not implemented: navigation') ||
      args[0]?.includes?.('Not implemented: window.getComputedStyle') ||
      args[0]?.includes?.('An update to') ||
      args[0]?.includes?.('When testing, code that causes React state updates')
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

// Setup for each test
beforeEach(() => {
  // Reset fetch mock
  global.fetch.mockClear()
  
  // Clear localStorage
  if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.clear === 'function') {
    localStorage.clear()
  }
  
  // Clear sessionStorage
  if (typeof sessionStorage !== 'undefined' && sessionStorage && typeof sessionStorage.clear === 'function') {
    sessionStorage.clear()
  }
})

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks()
  
  // Clear all timers
  if (jest.isMockFunction(global.setTimeout)) {
    jest.clearAllTimers()
  }
})

// Export utilities for tests
export const flushPromises = () => new Promise(resolve => setImmediate(resolve))

export const waitForNextUpdate = () => new Promise(resolve => setTimeout(resolve, 0))