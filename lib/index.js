const Joi = require('@hapi/joi')
const Analytics = require('./analytics')
const debug = require('debug')('hapi-gapi')

const configSchema = Joi.object({
  // gaPropertyId: Joi.string().min(2).required(),
  propertySettings: Joi.array()
    .items(
      Joi.object({
        id: Joi.string()
          .min(2)
          .required(),
        hitTypes: Joi.array()
          .items(Joi.string().valid('pageview'), Joi.string().valid('event'), Joi.string().valid('ecommerce'))
          .min(1)
          .required()
      })
    )
    .required(),
  trackAnalytics: Joi.function(),
  sessionIdProducer: Joi.function()
    .arity(1)
    .required(),
  attributionProducer: Joi.function().arity(1),
  batchSize: Joi.number()
    .min(1)
    .max(20),
  batchInterval: Joi.number()
    .min(1000)
    .max(60000)
})

exports.plugin = {
  pkg: require('../package.json'),

  /**
   * Initialise the hapi-gapi plugin
   *
   * @param server the hapi server instance
   * @param options the hapi-gapi configuration settings
   */
  register: async (server, options) => {
    const configValidation = configSchema.validate(options)
    if (configValidation.error) {
      throw configValidation.error
    }

    const analytics = new Analytics(options)

    server.decorate('request', 'ga', request => analytics.ga(request), { apply: true })

    server.ext('onPreResponse', async (request, h) => {
      const response = request.response
      const statusFamily = Math.floor(response.statusCode / 100)
      const shouldTrack = options.trackAnalytics ? options.trackAnalytics(request) : true
      if (shouldTrack) {
        debug('Session is being tracked')
        if (statusFamily === 2 && response.variety === 'view') {
          debug('Sending analytics page-view for %s', request.route.path)
          await request.ga.pageView()
        } else if (statusFamily === 5) {
          debug('Sending exception event for route %s with with status code %s', request.route.path, response.statusCode)
          await request.ga.event({ category: 'Exception', action: request.route.path, label: response.statusCode })
        }
      } else {
        debug('Session is not being tracked')
      }
      return h.continue
    })

    server.ext('onPostStop', async () => {
      await analytics.shutdown()
      server.log(['hapi-gapi'], 'All buffered events sent to the Google Analytics Measurement Protocol API.')
    })
  }
}
