const Joi = require('@hapi/joi')
const Analytics = require('./analytics')
const debug = require('debug')('hapi-gapi')

const configSchema = Joi.object({
  propertySettings: Joi.array()
    .items(
      Joi.object({
        id: Joi.string()
          .min(2)
          .required(),
        key: Joi.string()
          .min(2)
          .required(),
        hitTypes: Joi.array()
          .items(Joi.string().valid('page_view'))
          .min(1)
          .required()
      })
    )
    .required(),
  trackAnalytics: Joi.function(),
  sessionIdProducer: Joi.function()
    .arity(1)
    .required()
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
      const shouldTrack = options.trackAnalytics ? await options.trackAnalytics(request) : true
      const response = request.response
      const statusFamily = Math.floor(response.statusCode / 100)
      if (shouldTrack) {
        debug('Session is being tracked')
        if (statusFamily === 2 && response.variety === 'view') {
          debug('Sending analytics page-view for %s', request.route.path)
          await request.ga.pageView()
        } else if (statusFamily === 5) {
          debug('Sending exception event for route %s with with status code %s', request.route.path, response.statusCode)
        }
      } else {
        debug('Session is not being tracked')
      }
      return h.continue
    })
  }
}
