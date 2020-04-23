const Code = require('@hapi/code')
const Lab = require('@hapi/lab')
const sinon = require('sinon')
const wreck = require('@hapi/wreck')
const querystring = require('querystring')
const hapiTestServer = require('./helpers/hapi-server')
const { expect } = Code
const { before, after, afterEach, describe, it } = (exports.lab = Lab.script())

describe('Hapi Plugin', () => {
  before(async () => {
    await hapiTestServer.start({
      propertySettings: [{ id: 'UA-XXXXXX', hitTypes: ['pageview'] }],
      sessionIdProducer: request => 'test-session',
      batchSize: 1,
      batchInterval: 1000
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
        expect(url).to.equal('https://www.google-analytics.com/batch')

        const hits = options.payload.split('\n')
        expect(hits).to.be.an.array()
        expect(hits).to.have.length(1)

        const hit = querystring.parse(hits[0])
        expect(hit.v).to.equal('1')
        expect(hit.t).to.equal('pageview')
        expect(hit.aip).to.equal('1')
        expect(hit.ds).to.equal('web')
        expect(hit.dh).to.equal('localhost:33000')
        expect(hit.ua).to.equal('shot')
        expect(hit.dp).to.equal('/view')
        resolve()
      })

      hapiTestServer.inject({ method: 'GET', url: '/view' })
    })
  })

  it('anonymises ipv4 addresses', { timeout: 3000 }, () => {
    return new Promise(resolve => {
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        expect(method).to.equal('post')
        expect(url).to.equal('https://www.google-analytics.com/batch')

        const hits = options.payload.split('\n')
        expect(hits).to.be.an.array()
        expect(hits).to.have.length(1)

        const hit = querystring.parse(hits[0])
        expect(hit.t).to.equal('pageview')
        expect(hit.aip).to.equal('1')
        expect(hit.uip).to.equal('203.0.113.0')
        resolve()
      })

      hapiTestServer.inject({ method: 'GET', url: '/view', remoteAddress: '203.0.113.6' })
    })
  })

  it('anonymises ipv6 addresses', { timeout: 3000 }, () => {
    return new Promise(resolve => {
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        expect(method).to.equal('post')
        expect(url).to.equal('https://www.google-analytics.com/batch')

        const hits = options.payload.split('\n')
        expect(hits).to.be.an.array()
        expect(hits).to.have.length(1)

        const hit = querystring.parse(hits[0])
        expect(hit.t).to.equal('pageview')
        expect(hit.aip).to.equal('1')
        expect(hit.uip).to.equal('2001:d00::')
        resolve()
      })

      hapiTestServer.inject({ method: 'GET', url: '/view', remoteAddress: '2001:0db8:0000:0000:0000:8a2e:0370:7334' })
    })
  })

  it('does not generate page views for static resources', { timeout: 3000 }, () => {
    return new Promise((resolve, reject) => {
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        const msg = 'Unexpected request to the google measurement protocol api: should not send hits for static resources'
        Code.fail(msg)
        reject(new Error(msg))
      })
      hapiTestServer.inject({ method: 'GET', url: '/example.txt' })

      // Wait a few seconds to allow the internal batch interval to fire
      setTimeout(resolve, 2500)
    })
  })

  it('generate exception events instead of page views on 5xx errors', { timeout: 3000 }, () => {
    return new Promise((resolve, reject) => {
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        const hits = options.payload.split('\n')
        expect(hits).to.be.an.array()
        expect(hits).to.have.length(1)
        const hit = querystring.parse(hits[0])
        expect(hit.t).to.equal('event')
        expect(hit.ec).to.equal('Exception')
        expect(hit.ea).to.equal('/boom')
        expect(hit.el).to.equal('500')
      })
      hapiTestServer.inject({ method: 'GET', url: '/boom' })

      // Wait a few seconds to allow the internal batch interval to fire
      setTimeout(resolve, 2500)
    })
  })
})

describe('Hapi Plugin Registration Options', () => {
  afterEach(async () => {
    await hapiTestServer.stop()
    sinon.restore()
  })

  it('requires propertySettings to be defined', async () => {
    await expect(hapiTestServer.start({})).reject('"propertySettings" is required')
  })

  it('requires propertySettings to be an array', async () => {
    await expect(hapiTestServer.start({ propertySettings: {} })).reject('"propertySettings" must be an array')
  })

  it('requires propertySettings to be an array with at least one property object', async () => {
    await expect(hapiTestServer.start({ propertySettings: [] })).reject('"propertySettings" does not contain 1 required value(s)')
  })

  it('requires propertySettings to contain a property with a valid id', async () => {
    await expect(hapiTestServer.start({ propertySettings: [{}] })).reject('"propertySettings[0].id" is required')
  })

  it('requires propertySettings to contain a property with a hitTypes array containing at least 1 type', async () => {
    await expect(hapiTestServer.start({ propertySettings: [{ id: 'UA-XXXXXX-XX', hitTypes: [] }] })).reject(
      '"propertySettings[0].hitTypes" must contain at least 1 items'
    )
  })

  it('requires propertySettings to contain a property with a hitTypes array containing at least 1 type', async () => {
    await expect(hapiTestServer.start({ propertySettings: [{ id: 'UA-XXXXXX-XX', hitTypes: ['invalid'] }] })).reject(
      '"propertySettings[0].hitTypes[0]" does not match any of the allowed types'
    )
  })

  it('throws if session id producer function is not defined', async () => {
    await expect(hapiTestServer.start({ propertySettings: [{ id: 'UA-XXXXXX-XX', hitTypes: ['pageview', 'event', 'ecommerce'] }] })).reject(
      '"sessionIdProducer" is required'
    )
  })

  it('throws if session id producer function does not accept request as an argument', async () => {
    await expect(
      hapiTestServer.start({
        propertySettings: [{ id: 'UA-XXXXXX-XX', hitTypes: ['pageview', 'event', 'ecommerce'] }],
        sessionIdProducer: () => {}
      })
    ).reject('"sessionIdProducer" must have an arity of 1')
  })
})
