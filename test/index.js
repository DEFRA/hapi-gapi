const Hapi = require('@hapi/hapi')
const Inert = require('@hapi/inert')
const Vision = require('@hapi/vision')
const Nunjucks = require('nunjucks')

const Code = require('@hapi/code')
const Lab = require('@hapi/lab')
const Path = require('path')
const sinon = require('sinon')
const { expect } = Code
const { before, after, afterEach, describe, it } = exports.lab = Lab.script()
const wreck = require('@hapi/wreck')

const querystring = require('querystring')

const HapiGapi = require('../lib/index')

let server
describe('Hapi Plugin', () => {
  before(async () => {
    server = Hapi.server({
      host: 'localhost',
      port: 33000,
      routes: {
        files: {
          relativeTo: Path.join(__dirname, 'static')
        }
      }
    })
    await server.register(Inert)
    await server.register(Vision)
    await server.register({
      plugin: HapiGapi,
      options: {
        gaPropertyId: 'UA-XXXXXX',
        sessionIdProducer: (request) => 'test-session',
        batchSize: 1,
        batchInterval: 1000
      }
    })

    // Register static resource route handler
    server.route({
      method: 'GET',
      path: '/{param*}',
      handler: {
        directory: {
          path: '.',
          redirectToSlash: true,
          index: true
        }
      }
    })

    server.views({
      engines: {
        html: {
          compile: (src, options) => {
            const template = Nunjucks.compile(src, options.environment)
            return (context) => {
              return template.render(context)
            }
          },
          prepare: (options, next) => {
            options.compileOptions.environment = Nunjucks.configure(options.path, { watch: false })
            return next()
          }
        }
      },
      relativeTo: __dirname,
      path: 'templates'
    })

    server.route({
      method: 'GET',
      path: '/view',
      handler: (request, h) => {
        return h.view('example.html', {
          data: 'view demonstration'
        })
      }
    })

    await server.start()
    console.log('Server running on %s', server.info.uri)
  })

  after(async () => {
    await server.stop()
  })

  afterEach(() => {
    sinon.restore()
  })

  it('handles 2xx page views', { timeout: 30000 }, () => {
    return new Promise((resolve) => {
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        const hit = querystring.parse(options.payload)
        expect(method).to.equal('post')
        expect(url).to.equal('https://www.google-analytics.com/batch')
        expect(hit.v).to.equal('1')
        // expect(hit.tid).to.equal(TEST_PROPERTY)
        expect(hit.aip).to.equal('1')
        expect(hit.ds).to.equal('web')
        expect(hit.dh).to.equal('localhost:33000')
        expect(hit.ua).to.equal('shot')
        expect(hit.dp).to.equal('/view')
        expect(hit.dt).to.equal('/view')
        resolve()
      })

      server.inject({ method: 'GET', url: '/view' })
    })
  })

  it('ignores static resources', { timeout: 5000 }, () => {
    return new Promise((resolve, reject) => {
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        const msg = 'Unexpected request to the google measurement protocol api: should not send hits for static resources'
        Code.fail(msg)
        reject(new Error(msg))
      })
      server.inject({ method: 'GET', url: '/example.txt' })

      // Wait a few seconds to allow the internal batch interval to fire
      setTimeout(resolve, 4000)
    })
  })
})
