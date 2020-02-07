const Code = require('@hapi/code')
const Lab = require('@hapi/lab')
const sinon = require('sinon')
const wreck = require('@hapi/wreck')
const querystring = require('querystring')
const hapiTestServer = require('./helpers/hapi-server')
const { expect } = Code
const { before, after, afterEach, describe, it } = exports.lab = Lab.script()

describe('Hapi Plugin', () => {
  before(async () => {
    await hapiTestServer.start({
      gaPropertyId: 'UA-XXXXXX',
      sessionIdProducer: (request) => 'test-session',
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
    return new Promise((resolve) => {
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        const hit = querystring.parse(options.payload)
        expect(method).to.equal('post')
        expect(url).to.equal('https://www.google-analytics.com/batch')
        expect(hit.v).to.equal('1')
        expect(hit.aip).to.equal('1')
        expect(hit.ds).to.equal('web')
        expect(hit.dh).to.equal('localhost:33000')
        expect(hit.ua).to.equal('shot')
        expect(hit.dp).to.equal('/view')
        expect(hit.dt).to.equal('/view')
        resolve()
      })

      hapiTestServer.inject({ method: 'GET', url: '/view' })
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

  it('does not generate page views on 5xx errors', { timeout: 3000 }, () => {
    return new Promise((resolve, reject) => {
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        const msg = 'Unexpected request to the google measurement protocol api: should not send hits for server errors'
        Code.fail(msg)
        reject(new Error(msg))
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

  it('throws if google analytics property is not defined', () => {
    expect(hapiTestServer.start({})).reject('"gaPropertyId" is required')
  })
  it('throws if session id producer function is not defined', () => {
    expect(hapiTestServer.start({ gaPropertyId: 'UA-XXXXXX-XX' })).reject('"sessionIdProducer" is required')
  })
  it('throws if session id producer function does not accept request as an argument', () => {
    expect(hapiTestServer.start({
      gaPropertyId: 'UA-XXXXXX-XX',
      sessionIdProducer: () => {}
    })).reject('"sessionIdProducer" must have an arity of 1')
  })
})
