const Joi = require('@hapi/joi')
const Analytics = require('./analytics')
const debug = require('debug')('hapi-gapi')

const configSchema = Joi.object({
  gaPropertyId: Joi.string().min(2).required(),
  sessionIdProducer: Joi.function().arity(1).required(),
  attributionProducer: Joi.function().arity(1),
  batchSize: Joi.number().min(1).max(20),
  batchInterval: Joi.number().min(1000).max(60000)
})

exports.plugin = {
  pkg: require('../package.json'),

  /**
   * Initialise the hapi-gapi plugin
   *
   * @param server the hapi server instance
   */
  register: async (server, options) => {
    const configValidation = configSchema.validate(options)
    if (configValidation.error) {
      throw configValidation.error
    }

    const analytics = new Analytics(options)

    server.decorate('request', 'ga', analytics.ga, { apply: true })

    server.ext('onPreResponse', async (request, h) => {
      const response = request.response
      if (response && (response.statusCode / 100) === 2 && response.variety === 'view') {
        debug('Sending analytics page-view for %s', request.route.path)
        await request.ga.pageView()
      }
      return h.continue
    })

    server.ext('onPostStop', async () => {
      await analytics.shutdown()
      server.log(['hapi-gapi'], 'All buffered events sent to the Google Analytics Measurement Protocol API.')
    })
  }
}
