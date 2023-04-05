const Lab = require('@hapi/lab')
const sinon = require('sinon')
// Below sinon require code and function is necessary
// to have the stub of debug work.
const debugStub = sinon.stub()
require('debug')
delete require.cache[require.resolve('debug')]
require.cache[require.resolve('debug')] = {
  exports: () => debugStub
}
require('debug')
const wreck = require('@hapi/wreck')
const { expect } = require('@hapi/code')
const { afterEach, beforeEach, describe, it } = (exports.lab = Lab.script())

const Analytics = require('../lib/analytics')
describe('Analytics', () => {
  beforeEach(() => {
    process.env.ANALYTICS_XGOV_PROPERTY = 'testProperty'
    process.env.ANALYTICS_PROPERTY_API = 'testSecret'
  })
  afterEach(() => {
    delete process.env.ANALYTICS_XGOV_PROPERTY
    delete process.env.ANALYTICS_PROPERTY_API
    delete process.env.HTTPS_PROXY
    delete process.env.https_proxy
  })

  describe('HTTPS_PROXY environment variable', () => {
    it('should use HTTPS_PROXY if it is set', () => {
      process.env.HTTPS_PROXY = 'https://myproxy:8080'
      const analytics = new Analytics(getSettings({}))
      expect(analytics._agent.proxy.href).to.equal('https://myproxy:8080/')
    })

    it('should use https_proxy if HTTPS_PROXY is not set', () => {
      process.env.https_proxy = 'https://myproxy:1234'
      const analytics = new Analytics(getSettings({}))
      expect(analytics._agent.proxy.href).to.equal('https://myproxy:1234/')
    })
  })

  describe('analytics object agent property', () => {
    it('should use HTTPS_PROXY if it is set', () => {
      process.env.HTTPS_PROXY = 'https://myproxy:8080'
      const analytics = new Analytics(getSettings({}))
      expect(analytics._agent.proxy.href).to.equal('https://myproxy:8080/')
    })

    it('should use https_proxy if HTTPS_PROXY is not set', () => {
      process.env.https_proxy = 'https://myproxy:1234'
      const analytics = new Analytics(getSettings({}))
      expect(analytics._agent.proxy.href).to.equal('https://myproxy:1234/')
    })

    it('should use be undefined is neither HTTPS_PROXY or https_proxy set', () => {
      const analytics = new Analytics(getSettings({}))
      expect(analytics._agent).to.equal(undefined)
    })
  })

  describe('ga', () => {
    it('should return an object with a pageView method', () => {
      const analytics = new Analytics(getSettings({}))
      const result = analytics.ga({})
      expect(result).to.be.an.object()
      expect(result.pageView).to.be.a.function()
    })

    it('should call hit method with correct arguments', () => {
      const analytics = new Analytics(getSettings({}))
      const hitSpy = sinon.spy(analytics, 'hit')
      analytics.ga(getRequest()).pageView({ userId: '123' })
      expect(hitSpy.calledWith('page_view', 'example_request', { t: 'page_view', userId: '123' }))
    })
  })

  describe('hit', () => {
    it('should call send with the correct parameters', async () => {
      const payload = { t: 'page_view', page_view: 'True', page_title: 'page_path' }
      const analytics = new Analytics(
        getSettings({ propertySettings: [{ id: 'G-XXXXXXX', key: '3454534', hitTypes: ['pageview'] }] }, { sessionIdProducer: '123' })
      )
      const sendStub = sinon.stub(analytics, 'send')
      await analytics.hit('page_view', getRequest(), payload)
      expect(
        sendStub.calledWith(analytics._propertySettings[0].id, analytics._propertySettings[0].key, 'page_path', sinon.match.string)
      ).to.be.true()
      sendStub.restore()
    })

    it('should stop the process return debug message if the property length is 0', async () => {
      process.env.DEBUG = 'hapi-gapi:*'
      const analytics = new Analytics(getSettings({ propertySettings: [] }))
      await analytics.hit('page_view', getRequest(), {})
      sinon.assert.calledWith(debugStub, 'No property settings')
    })
  })

  describe('send', () => {
    it('should make a post request to the Google Analytics API', async () => {
      const analytics = new Analytics(
        getSettings({ propertySettings: { id: '234', key: 'secretshhh', hitTypes: ['pageview'] } }, { sessionIdProducer: '123' })
      )
      const measurementId = analytics._propertySettings.id
      const apiSecret = analytics._propertySettings.key
      const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
      await analytics.send(measurementId, apiSecret, 'page_path', 'session_id')
      expect(wreckRequestStub.calledOnce).to.be.true()
      expect(wreckRequestStub.getCall(0).args[0]).to.equal('post')
      expect(wreckRequestStub.getCall(0).args[1]).to.equal(
        `https://www.google-analytics.com/mp/collect?api_secret=${apiSecret}&measurement_id=${measurementId}`
      )
      expect(wreckRequestStub.getCall(0).args[2].payload).to.include({
        user_id: 'session_id',
        events: [
          {
            name: 'page_view',
            params: {
              page_view: 'True',
              page_title: 'page_path'
            }
          }
        ]
      })
      expect(wreckRequestStub.getCall(0).args[2].timeout).to.equal(1000)
      wreckRequestStub.restore()
    })

    it('should log a message after completing the request', async () => {
      process.env.DEBUG = 'hapi-gapi:*'
      const analytics = new Analytics(getSettings({ id: 'G-XXXXXXX', key: '3454534', hitTypes: ['pageview'] }, '123'))
      const wreckRequestStub = sinon.stub(wreck, 'request')
      wreckRequestStub.resolves()
      await analytics.send('test-measurement-id', 'test-api-secret', 'test-page-path', 'test-session-id')

      sinon.assert.calledWith(debugStub, 'Completed request to google analytics measurement protocol API')
    })
  })
})

const getSettings = ({ propertySettings = [], id = '123' }) => ({
  propertySettings,
  sessionIdProducer: async request => {
    return id
  }
})
const getRequest = () => ({
  route: {
    fingerprint: 'page_path'
  }
})
