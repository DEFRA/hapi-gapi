const Hapi = require('@hapi/hapi')
const Inert = require('@hapi/inert')
const Vision = require('@hapi/vision')
const Nunjucks = require('nunjucks')
const Path = require('path')
const HapiGapi = require('../../lib/index')

let server
module.exports = {
  start: async (hapiGapiOptions) => {
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
      options: hapiGapiOptions
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
  },
  stop: async () => {
    if (server) await server.stop()
  },
  inject: async (options) => server.inject(options)
}
