const Analytics = require('../lib/analytics')
const fetch = require('node-fetch')
jest.mock('node-fetch', () => jest.fn())

describe('Analytics', () => {
  beforeEach(() => {
    process.env.ANALYTICS_XGOV_PROPERTY = 'testProperty'
    process.env.ANALYTICS_PROPERTY_API = 'testSecret'
  })

  afterEach(() => {
    delete process.env.ANALYTICS_XGOV_PROPERTY
    delete process.env.ANALYTICS_PROPERTY_API
    jest.resetAllMocks()
  })

  describe('ga', () => {
    it('should return a view function', () => {
      const analytics = new Analytics({ propertySettings: [{ id: '123', key: 'fakeKey' }], sessionIdProducer: () => '123' })
      expect(analytics.ga()).toBeDefined()
      expect(typeof analytics.ga().view).toBe('function')
    })
  })

  describe('view', () => {
    it('should send a view event', async () => {
      const mockRes = { status: 204 }
      fetch.mockResolvedValueOnce(() => Promise.resolve | (mockRes))
      const propertySettings = [{ id: 'testProperty', key: 'testSecret', hitTypes: ['pageview'] }]
      const analyticsURI = `https://www.google-analytics.com/mp/collect?measurement_id=${propertySettings[0].id}&api_secret=${propertySettings[0].key}`
      const sessionIdProducer = jest.fn(() => '123')
      const params = { name: 'pageview', params: { page_path: '/test', page_title: 'test' } }
      const request = {}
      const analytics = new Analytics({ propertySettings, sessionIdProducer })

      await analytics.view(request, params)
      expect(fetch).toHaveBeenCalledWith(
        analyticsURI,
        {
          body: '{"client_id":"123","user_id":"123","events":{"name":"pageview","params":{"page_path":"/test","page_title":"test"}}}',
          method: 'POST'
        })
    })

    it('should NOT send an event if propertySettings are missing', async () => {
      const mockRes = { status: 204 }
      fetch.mockResolvedValueOnce(() => Promise.resolve | (mockRes))
      const propertySettings = []
      const sessionIdProducer = jest.fn(() => '123')
      const params = { name: 'pageview', params: { page_path: '/test', page_title: 'test' } }
      const request = {}
      const analytics = new Analytics({ propertySettings, sessionIdProducer })

      await analytics.view(request, params)
      expect(fetch).toHaveBeenCalledTimes(0)
    })
  })
})
