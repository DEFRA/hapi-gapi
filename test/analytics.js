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

  describe('pageView', () => {
    describe('posts requests to Google Analytics API', () => {
      const measurementId = '234'
      const apiSecret = 'secretshhh'
      const getAnalytics = () =>
        new Analytics(getSettings({ propertySettings: [{ id: measurementId, key: apiSecret }] }, { sessionIdProducer: () => '123' }))

      it('calls wreck', async () => {
        const analytics = getAnalytics()
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        await analytics.ga(getRequest()).pageView()
        expect(wreckRequestStub.calledOnce).to.be.true()
        wreckRequestStub.restore()
      })

      it('makes POST request', async () => {
        const analytics = getAnalytics()
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        await analytics.ga(getRequest()).pageView()
        expect(wreckRequestStub.firstCall.firstArg).to.equal('post')
        wreckRequestStub.restore()
      })

      it('makes request to correct url', async () => {
        const analytics = getAnalytics()
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        await analytics.ga(getRequest()).pageView()
        expect(wreckRequestStub.firstCall.args[1]).to.equal(
          `https://www.google-analytics.com/mp/collect?api_secret=${apiSecret}&measurement_id=${measurementId}`
        )
        wreckRequestStub.restore()
      })

      it('sends expected payload', async () => {
        const analytics = getAnalytics()
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        await analytics.ga(getRequest()).pageView()
        expect(wreckRequestStub.firstCall.args[2].payload).to.include({
          user_id: '123',
          client_id: '123',
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
        wreckRequestStub.restore()
      })

      it('timeout set to one second', async () => {
        const analytics = getAnalytics()
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        await analytics.ga(getRequest()).pageView()
        expect(wreckRequestStub.firstCall.args[2].timeout).to.equal(1000)
        wreckRequestStub.restore()
      })
    })

    describe('sends a request for each property', () => {
      const propertyIds = ['234', '123456789']
      const apiSecrets = ['secretshhh', 'secret-squirrel']
      const getAnalytics = () =>
        new Analytics(
          getSettings(
            {
              propertySettings: [
                { id: propertyIds[0], key: apiSecrets[0] },
                { id: propertyIds[1], key: apiSecrets[1] }
              ]
            },
            {
              sessionIdProducer: () => '123'
            }
          )
        )

      it('calls wreck twice for two properties', async () => {
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        const analytics = getAnalytics()
        await analytics.ga(getRequest()).pageView()
        expect(wreckRequestStub.callCount).to.equal(2)
        wreckRequestStub.restore()
      })

      it('sends correct property id for each property', async () => {
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        const analytics = getAnalytics()
        await analytics.ga(getRequest()).pageView()
        for (let x = 0; x < 2; x++) {
          const propertyId = propertyIds[x]
          expect(wreckRequestStub.getCall(x).args[1]).to.match(new RegExp(`\\?.*measurement_id=${propertyId}.*$`))
        }
        wreckRequestStub.restore()
      })

      it('sends correct api secret for each property', async () => {
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        const analytics = getAnalytics()
        await analytics.ga(getRequest()).pageView()
        for (let x = 0; x < 2; x++) {
          const apiSecret = apiSecrets[x]
          expect(wreckRequestStub.getCall(x).args[1]).to.match(new RegExp(`\\?.*api_secret=${apiSecret}.*$`))
        }
        wreckRequestStub.restore()
      })
    })

    describe('no property settings', () => {
      const getAnalytics = () => new Analytics(getSettings({ propertySettings: [] }, { sessionIdProducer: () => '123' }))

      beforeEach(() => {
        debugStub.resetHistory()
      })

      it("doesn't make a request", async () => {
        const wreckRequestStub = sinon.stub(wreck, 'request').resolves()
        const analytics = getAnalytics()
        await analytics.ga(getRequest()).pageView()
        expect(wreckRequestStub.callCount).to.equal(0)
        wreckRequestStub.restore()
      })

      it('logs a debug message', async () => {
        const analytics = getAnalytics()
        await analytics.ga(getRequest()).pageView()
        console.log(debugStub.getCalls())
        expect(debugStub.getCall(0).firstArg).to.equal('No property settings')
      })
    })

    it('should log a message after completing the request', async () => {
      process.env.DEBUG = 'hapi-gapi:*'
      const analytics = new Analytics(getSettings({ id: 'G-XXXXXXX', key: '3454534', hitTypes: ['pageview'] }, '123'))
      const wreckRequestStub = sinon.stub(wreck, 'request')
      wreckRequestStub.resolves()
      await analytics.send('test-measurement-id', 'test-api-secret', 'test-page-path', 'test-session-id')

      sinon.assert.calledWith(debugStub, 'Completed request to google analytics measurement protocol API')
      wreckRequestStub.restore()
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
