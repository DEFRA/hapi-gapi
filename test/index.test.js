
const indexPlugin = require('../lib/index')
const analytics = require('../lib/analytics')
jest.mock('node-fetch', () => jest.fn())
jest.mock('../lib/analytics')

describe('Index', () => {
  beforeEach(() => {
    process.env.ANALYTICS_XGOV_PROPERTY = 'testProperty'
    process.env.ANALYTICS_PROPERTY_API = 'testSecret'
  })

  afterEach(() => {
    delete process.env.ANALYTICS_XGOV_PROPERTY
    delete process.env.ANALYTICS_PROPERTY_API
    jest.resetAllMocks()
  })

  describe('register', () => {
    it('should throw an error if the provided options are incorrect', async () => {
      const server = {
        decorate: jest.fn(),
        ext: jest.fn()
      }

      await expect(indexPlugin.plugin.register(server, {})).rejects.toThrow('"propertySettings" is required')
      expect(server.decorate).toHaveBeenCalledTimes(0)
      expect(server.ext).toHaveBeenCalledTimes(0)
    })

    it('should initiate Analytics if the provided options are correct', async () => {
      expect(indexPlugin.plugin.register).toBeDefined()
      expect(typeof indexPlugin.plugin.register).toBe('function')
      const server = {
        decorate: jest.fn().mockImplementation(),
        ext: jest.fn().mockImplementation()
      }
      const options = {
        trackAnalytics: async () => false,
        propertySettings: [
          {
            key: 'superSecretKey',
            id: 'FakeId',
            hitTypes: ['page_view']
          }
        ],
        sessionIdProducer: async request => '123'
      }
      const viewSpy = jest.fn().mockImplementation(() => Promise.resolve())
      analytics.mockImplementation(() => {
        return {
          ga: {
            view: viewSpy
          }
        }
      })

      await indexPlugin.plugin.register(server, options)
      expect(server.decorate).toHaveBeenCalledTimes(1)
      expect(server.decorate).toHaveBeenCalledWith('request', 'ga', expect.any(Function), { apply: true })
      expect(server.ext).toHaveBeenCalledTimes(1)
      expect(server.ext).toHaveBeenCalledWith('onPreResponse', expect.any(Function))
      expect(analytics).toHaveBeenCalledTimes(1)
      expect(analytics).toHaveBeenCalledWith(options)
    })

    it('should track if trackAnalytics option is set to true', async () => {
      const viewSpy = jest.fn().mockImplementation(() => {
        return Promise.resolve()
      })
      const callback = jest.fn()
      const options = {
        trackAnalytics: async () => true,
        propertySettings: [
          {
            key: 'superSecretKey',
            id: 'FakeId',
            hitTypes: ['page_view']
          }
        ],
        sessionIdProducer: async request => '123'
      }
      const mockRequest = {
        ga: {
          view: viewSpy
        },
        response: {
          statusCode: 204,
          variety: 'view'
        },
        route: {
          path: '/test'
        }
      }
      await indexPlugin.handler(mockRequest, options, callback)
      expect(callback).toHaveBeenCalledTimes(0)
      expect(viewSpy).toHaveBeenCalledTimes(1)
    })

    it('should NOT track if trackAnalytics option is set to false', async () => {
      const viewSpy = jest.fn().mockImplementation(() => {
        return Promise.resolve()
      })
      const callback = jest.fn()
      const options = {
        trackAnalytics: async () => false,
        propertySettings: [
          {
            key: 'superSecretKey',
            id: 'FakeId',
            hitTypes: ['page_view']
          }
        ],
        sessionIdProducer: async request => '123'
      }
      const mockRequest = {
        ga: {
          view: viewSpy
        },
        response: {
          statusCode: 204,
          variety: 'view'
        },
        route: {
          path: '/test'
        }
      }
      await indexPlugin.handler(mockRequest, options, callback)
      expect(callback).toHaveBeenCalledTimes(0)
      expect(viewSpy).toHaveBeenCalledTimes(0)
    })

    it('should send exception event to GA on 50X responses', async () => {
      const viewSpy = jest.fn().mockImplementation(() => {
        return Promise.resolve()
      })
      const callback = jest.fn()
      const options = {
        trackAnalytics: async () => true,
        propertySettings: [
          {
            key: 'superSecretKey',
            id: 'FakeId',
            hitTypes: ['page_view']
          }
        ],
        sessionIdProducer: async request => '123'
      }
      const mockRequest = {
        ga: {
          view: viewSpy
        },
        response: {
          statusCode: 500,
          variety: 'view'
        },
        route: {
          path: '/test'
        }
      }
      await indexPlugin.handler(mockRequest, options, callback)
      expect(callback).toHaveBeenCalledTimes(0)
      expect(viewSpy).toHaveBeenCalledTimes(1)
    })
  })
})
