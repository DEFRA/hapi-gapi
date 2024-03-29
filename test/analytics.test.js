const Analytics = require('../lib/analytics')
// const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
// const mockFetch = jest.fn().mockResolvedValueOnce({ status: 204, statusText: 'OK' })
const fetch = require('node-fetch')
jest.mock('node-fetch')

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
      expect.assertions(3) // -- Important! This ensures that assertions in the async function are run - Update if you add more assertions
      const mockRes = { status: 204, statusText: 'OK' }
      fetch.mockResolvedValueOnce(mockRes)
      const logSpy = jest.spyOn(console, 'log')
      const propertySettings = [{ id: 'testProperty', key: 'testSecret', hitTypes: ['pageview'] }]
      const analyticsURI = `https://www.google-analytics.com/mp/collect?measurement_id=${propertySettings[0].id}&api_secret=${propertySettings[0].key}`
      const sessionIdProducer = jest.fn(() => '123')
      const metrics = [{ name: 'pageview', params: { page_path: '/test', page_title: 'test' } }]
      const request = {}
      const analytics = new Analytics({ propertySettings, sessionIdProducer })

      await analytics.view(request, metrics)
      expect(fetch).toHaveBeenCalledWith(
        analyticsURI,
        {
          body: JSON.stringify({
            client_id: '123',
            user_id: '123',
            events: [{ name: 'pageview', params: { page_path: '/test', page_title: 'test' } }],
          }),
          method: 'POST'
        }
      )
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(logSpy.mock.calls[0]).toStrictEqual(["Completed request to google analytics measurement protocol API", 204, 'OK'])
    })

    it('should NOT send an event if propertySettings are missing', async () => {
      expect.assertions(1)
      const mockRes = { status: 204 }
      fetch.mockResolvedValueOnce(mockRes)
      const propertySettings = []
      const sessionIdProducer = jest.fn(() => '123')
      const events = [{ name: 'pageview', params: { page_path: '/test', page_title: 'test' } }]
      const request = {}
      const analytics = new Analytics({ propertySettings, sessionIdProducer })

      await analytics.view(request, events)
      expect(fetch).toHaveBeenCalledTimes(0)
    })
  })

  describe('sendEvent', () => {
    const events = ['event1', 'event2'];
    const measurementId = 'your-measurement-id';
    const apiSecret = 'your-api-secret';
    const sessionId = 'your-session-id';
    const sessionIdProducer = jest.fn(() => '123')
    const propertySettings = [{ id: measurementId, key: apiSecret, hitTypes: ['pageview'] }]
    const analyticsURI = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`
    it('should send an event to Google Analytics', async () => {
      expect.assertions(3)
      const mockRes = { status: 204, statusText: 'OK' }
      fetch.mockResolvedValueOnce(mockRes)
      const logSpy = jest.spyOn(console, 'log')

      const analytics = new Analytics({ propertySettings, sessionIdProducer })

      await analytics.sendEvent(events, measurementId, apiSecret, sessionId);
      expect(fetch).toHaveBeenCalledWith(
        analyticsURI,
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: sessionId,
            user_id: sessionId,
            events: ['event1', 'event2'],
          })
        }
      )
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        'Completed request to google analytics measurement protocol API',
        204,
        'OK'
      );
    });

    it('error handling', async () => {
      expect.assertions(3)
      fetch.mockRejectedValueOnce({ response: { status: 404, statusText: 'Not Found' } });
      const logSpy = jest.spyOn(console, 'error')

      const analytics = new Analytics({ propertySettings, sessionIdProducer })

      await analytics.sendEvent(events, measurementId, apiSecret, sessionId);
      expect(fetch).toHaveBeenCalledWith(
        analyticsURI,
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: sessionId,
            user_id: sessionId,
            events: ['event1', 'event2'],
          })
        }
      )
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith("Error sending GA request:", { "response": { "status": 404, "statusText": "Not Found" } });
    });
  });
})
