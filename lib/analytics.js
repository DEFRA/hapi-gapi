const wreck = require('@hapi/wreck')
const HttpsProxyAgent = require('https-proxy-agent')
const debug = require('debug')('hapi-gapi')
// const ipAnonymise = require('ip-anonymize')
const Joi = require('@hapi/joi')

const attributionSchema = Joi.object({
  campaign: Joi.string()
    .trim()
    .required(),
  source: Joi.string().trim(),
  medium: Joi.string(),
  term: Joi.string(),
  content: Joi.string(),
  id: Joi.string().trim()
}).or('source', 'id')

module.exports = class Analytics {
  constructor ({
    propertySettings,
    sessionIdProducer,
    attributionProducer = async () => {
      // Default no attribution
    }
  }) {
    this._propertySettings = propertySettings
    this._sessionIdProducer = sessionIdProducer
    this._attributionProducer = attributionProducer
    const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
    this._agent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined
  }

  ga (request) {
    return {
      pageView: additionalPayload => this.hit('page_view', request, { t: 'page_view', ...additionalPayload })
    }
  }

  async hit (type, request, payload) {
    console.log('this._propertySettings: ', this._propertySettings)
    console.log('this._attributionProducer: ', this._attributionProducer)
    const measurementId = process.env.ANALYTICS_XGOV_PROPERTY
    const apiSecret = process.env.ANALYTICS_PROPERTY_API
    const pagePath = request.route.fingerprint
    if (this._propertySettings.length === 0) {
      debug('No property settings')
      return
    }
    const sessionId = await this._sessionIdProducer(request)
    const attribution = (await this._attributionProducer(request)) || {}
    console.log('here')
    if (Object.keys(attribution).length > 0) {
      console.log('there')
      const validationResult = attributionSchema.validate(attribution)
      if (validationResult.error) {
        console.log('where')
        console.warn('Attribution should contain campaign and one of source or id')
      }
    }
    await this.send(measurementId, apiSecret, pagePath, sessionId)
  }

  async send (measurementId, apiSecret, pagePath, sessionId) {
    debug('Processing post request for page: \n%s ', pagePath)
    // Don't await the request - the api always returns a 200 (even on error) and we don't want to block the server request being handled.
    wreck
      .request('post', `https://www.google-analytics.com/mp/collect?api_secret=${apiSecret}&measurement_id=${measurementId}`, {
        agent: this._agent,
        payload: {
          client_id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          user_id: sessionId,
          events: [
            {
              name: 'page_view',
              params: {
                page_view: 'True',
                page_title: pagePath
              }
            }
          ]
        },
        timeout: 0
      })
      .then(() => {
        debug('Completed request to google analytics measurement protocol API')
      })
  }

  async shutdown () {
    clearInterval(this._heartbeat)
    await this.send()
  }
}
