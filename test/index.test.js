
const indexPlugin = require('../lib/index')
const analytics = require('../lib/analytics')
jest.mock('axios')
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
    const viewSpy = jest.fn().mockImplementation(() => {
      return Promise.resolve()
    })
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
    const r = { response: { statusCode: 204, variety: 'view' }, route: { path: '/test', fingerprint: 'A7a' }, ga: { view: viewSpy } }

    it('should throw an error if the provided options are invalid', async () => {
      expect.assertions(5)
      const server = {
        decorate: jest.fn(),
        ext: jest.fn()
      }
      expect(indexPlugin.plugin.register).toBeDefined()
      expect(typeof indexPlugin.plugin.register).toBe('function')

      await expect(indexPlugin.plugin.register(server, {})).rejects.toThrow('"propertySettings" is required')

      expect(server.decorate).toHaveBeenCalledTimes(0)
      expect(server.ext).toHaveBeenCalledTimes(0)
    })

    it('should initiate Analytics - But it will not start tracking if options.trackAnalytics is set to false', async () => {
      expect.assertions(7)
      const server = {
        decorate: jest.fn().mockImplementation(),
        ext: jest.fn().mockImplementation(async (e, c) => {
          await c(r, { continue: "This is the best mock I ever wrote!" })
        })
      }
      options.trackAnalytics = async () => false
      analytics.mockImplementation(() => {
        return {
          ga: jest.fn().mockResolvedValueOnce({ view: viewSpy }),
        }
      })

      await indexPlugin.plugin.register(server, options)

      expect(server.decorate).toHaveBeenCalledTimes(1)
      expect(server.decorate).toHaveBeenCalledWith('request', 'ga', expect.any(Function), { apply: true })
      expect(server.ext).toHaveBeenCalledTimes(1)
      expect(server.ext).toHaveBeenCalledWith('onPreResponse', expect.any(Function))
      expect(analytics).toHaveBeenCalledTimes(1)
      expect(analytics).toHaveBeenCalledWith(options)
      expect(viewSpy).toHaveBeenCalledTimes(0)
    })

    it('should initiate Analytics if the provided options are valid - and start tracking page views', async () => {
      expect.assertions(8)
      const viewSpy = jest.fn().mockImplementation(() => {
        return Promise.resolve()
      })
      const r = { response: { statusCode: 204, variety: 'view' }, route: { path: '/test', fingerprint: 'A7a' }, ga: { view: viewSpy } }
      const server = {
        decorate: jest.fn().mockImplementation(),
        ext: jest.fn().mockImplementation(async (e, c) => {
          await c(r, { continue: "I bet no one will read this!" })
        })
      }
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
      analytics.mockImplementation(() => {
        return {
          ga: jest.fn().mockResolvedValueOnce({ view: viewSpy }),
        }
      })

      await indexPlugin.plugin.register(server, options)

      expect(server.decorate).toHaveBeenCalledTimes(1)
      expect(server.decorate).toHaveBeenCalledWith('request', 'ga', expect.any(Function), { apply: true })
      expect(server.ext).toHaveBeenCalledTimes(1)
      expect(server.ext).toHaveBeenCalledWith('onPreResponse', expect.any(Function))
      expect(analytics).toHaveBeenCalledTimes(1)
      expect(analytics).toHaveBeenCalledWith(options)
      expect(viewSpy).toHaveBeenCalledTimes(1)
      expect(viewSpy).toHaveBeenCalledWith(r, { name: "pageview", params: { page_path: "/test", page_title: "A7a" } })
    })
    it('should send exception event to GA on internal server errors 50X', async () => {
      expect.assertions(8)

      const viewSpy = jest.fn().mockImplementation(() => {
        return Promise.resolve()
      })

      const r = { response: { statusCode: 500, variety: 'view' }, route: { path: '/test', fingerprint: 'A7a' }, ga: { view: viewSpy } }
      const server = {
        decorate: jest.fn().mockImplementation(),
        ext: jest.fn().mockImplementation(async (_e, c) => {
          await c(r, { continue: "shame!" })
        })
      }
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
      analytics.mockImplementation(() => {
        return {
          ga: jest.fn().mockResolvedValueOnce({ view: viewSpy }),
        }
      })

      await indexPlugin.plugin.register(server, options)

      expect(server.decorate).toHaveBeenCalledTimes(1)
      expect(server.decorate).toHaveBeenCalledWith('request', 'ga', expect.any(Function), { apply: true })
      expect(server.ext).toHaveBeenCalledTimes(1)
      expect(server.ext).toHaveBeenCalledWith('onPreResponse', expect.any(Function))
      expect(analytics).toHaveBeenCalledTimes(1)
      expect(analytics).toHaveBeenCalledWith(options)
      expect(viewSpy).toHaveBeenCalledTimes(1)
      expect(viewSpy).toHaveBeenCalledWith(r, { name: "exception", params: { error: 500, page_path: "/test", page_title: "A7a" } })
    })
  })
})
