const Code = require('@hapi/code')
const Lab = require('@hapi/lab')
const sinon = require('sinon')
const wreck = require('@hapi/wreck')
const { expect } = Code
const { after, before, afterEach, describe, it } = (exports.lab = Lab.script())
const hapiTestServer = require('./helpers/hapi-server')

describe('register', () => {
  afterEach(() => {
    sinon.restore()
  })
  describe('2xx and 5xx response codes', async () => {
    before(async () => {
      await hapiTestServer.start({
        propertySettings: [{ id: 'G-XXXXXX', hitTypes: ['page_view'] }],
        sessionIdProducer: request => 'test-session'
      })
    })

    after(async () => {
      await hapiTestServer.stop()
    })

    afterEach(() => {
      sinon.restore()
    })

    it('handles 2xx page views', { timeout: 3000 }, () => {
      return new Promise(resolve => {
        sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
          expect(method).to.equal('post')
          expect(url).to.equal('https://www.google-analytics.com/mp/collect?api_secret=undefined&measurement_id=undefined')
          resolve()
        })
        hapiTestServer.inject({ method: 'GET', url: '/view' })
      })
    })

    it('generate exception events instead of page views on 5xx errors', { timeout: 3000 }, () => {
      return new Promise((resolve, reject) => {
        hapiTestServer.inject({ method: 'GET', url: '/boom' })
        // Wait a few seconds to allow the internal batch interval to fire
        setTimeout(resolve, 2500)
      })
    })
  })

  afterEach(async () => {
    await hapiTestServer.stop()
    sinon.restore()
  })

  it("doesn't track if trackAnalytics option returns false", async () => {
    await hapiTestServer.start({
      propertySettings: [{ id: 'G-XXXXXX', hitTypes: ['page_view'] }],
      sessionIdProducer: request => 'test-session',
      trackAnalytics: () => false
    })

    hapiTestServer.inject({ method: 'GET', url: '/view' })
  })

  it('passes request object to trackAnalytics hander', async () => {
    const trackAnalytics = sinon.spy()
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const msg = 'Unexpected request to the google measurement protocol api: should not send hits when trackAnalytics returns false'
      Code.fail(msg)
      throw new Error(msg)
    })

    await hapiTestServer.start({
      propertySettings: [{ id: 'G-XXXXXX', hitTypes: ['page_view'] }],
      sessionIdProducer: request => 'test-session',
      trackAnalytics
    })

    hapiTestServer.inject({ method: 'GET', url: '/view' })

    await new Promise(resolve => {
      setTimeout(resolve, 1500)
    })

    const [request] = trackAnalytics.getCall(0).args
    expect(request === undefined).to.be.false()
  })

  describe('debug', () => {
    const debugStub = sinon.stub()
    require('debug')
    delete require.cache[require.resolve('debug')]
    require.cache[require.resolve('debug')] = {
      exports: () => debugStub
    }
    require('debug')
    require('../lib/index.js')
    delete require.cache[require.resolve('../lib/index.js')]
    const index = require('../lib/index.js')

    it('should log a debug message if response code starting with 2 and is a page view', async () => {
      process.env.DEBUG = 'hapi-gapi:*'
      const mockServer = {
        decorate: sinon.stub(),
        ext: sinon.stub()
      }
      sinon.stub(wreck, 'request').resolves({ statusCode: 200 })
      const extFunction = index.plugin
      await extFunction.register(mockServer, getMockOptions())
      await mockServer.ext.firstCall.lastArg(
        {
          response: {
            statusCode: 200,
            variety: 'view'
          },
          route: {
            path: '/view'
          },
          ga: {
            pageView: () => {}
          }
        },
        { continue: 'continued' }
      )
      const expectedReturn = '/view'
      sinon.assert.calledWith(debugStub, 'Sending analytics page-view for %s', `${expectedReturn}`)
    })

    it('should log a debug message if response code starting with 5', async () => {
      process.env.DEBUG = 'hapi-gapi:*'
      const mockServer = {
        decorate: sinon.stub(),
        ext: sinon.stub()
      }
      sinon.stub(wreck, 'request').resolves({ statusCode: 200 })
      const extFunction = index.plugin
      await extFunction.register(mockServer, getMockOptions())
      await mockServer.ext.firstCall.lastArg(
        {
          response: {
            statusCode: 500
          },
          route: {
            path: '/boom'
          }
        },
        { continue: 'continued' }
      )
      const expectedPath = '/boom'
      const expectedStatusCode = 500
      sinon.assert.calledWith(debugStub, 'Sending exception event for route %s with with status code %s', expectedPath, expectedStatusCode)
    })
  })

  describe('joi validation', async () => {
    it('requires propertySettings to be defined', async () => {
      await expect(hapiTestServer.start({})).reject('"propertySettings" is required')
    })

    it('requires propertySettings to be an array', async () => {
      await expect(hapiTestServer.start({ propertySettings: {} })).reject('"propertySettings" must be an array')
    })

    it('allows propertySettings to be an empty array', async () => {
      await expect(hapiTestServer.start({ propertySettings: [], sessionIdProducer: r => {} })).not.reject()
    })

    it('requires propertySettings to contain a property with a valid id', async () => {
      await expect(hapiTestServer.start({ propertySettings: [{}] })).reject('"propertySettings[0].id" is required')
    })

    it('requires propertySettings to contain a property with a hitTypes array containing at least 1 type', async () => {
      await expect(hapiTestServer.start({ propertySettings: [{ id: 'G-XXXXXX-XX', hitTypes: [] }] })).reject(
        '"propertySettings[0].hitTypes" must contain at least 1 items'
      )
    })

    it('requires propertySettings to contain a property with a hitTypes array containing at least 1 type', async () => {
      await expect(hapiTestServer.start({ propertySettings: [{ id: 'G-XXXXXX-XX', hitTypes: ['invalid'] }] })).reject(
        '"propertySettings[0].hitTypes[0]" must be [page_view]'
      )
    })

    it('throws if session id producer function is not defined', async () => {
      await expect(hapiTestServer.start({ propertySettings: [{ id: 'G-XXXXXX-XX', hitTypes: ['page_view'] }] })).reject(
        '"sessionIdProducer" is required'
      )
    })
  })
})

const getMockOptions = () => ({
  propertySettings: [{ id: 'G-XXXXXX', hitTypes: ['page_view'] }],
  sessionIdProducer: request => 'test-session',
  trackAnalytics: () => true
})
