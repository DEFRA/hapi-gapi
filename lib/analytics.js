const wreck = require('@hapi/wreck')
const HttpsProxyAgent = require('https-proxy-agent')
const debug = require('debug')('hapi-gapi')

module.exports = class Analytics {
  constructor ({ propertySettings, sessionIdProducer }) {
    this._propertySettings = propertySettings
    this._sessionIdProducer = sessionIdProducer
    const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
    this._agent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined
  }

  ga (request) {
    return {
      pageView: () => this.hit(request)
    }
  }

  async hit (request) {
    if (this._propertySettings.length === 0) {
      debug('No property settings')
      return
    }
    const pagePath = request.route.fingerprint
    const sessionId = await this._sessionIdProducer(request)

    for (let x = 0; x < this._propertySettings.length; x++) {
      const measurementId = this._propertySettings[x].id
      const apiSecret = this._propertySettings[x].key
      await this.send(measurementId, apiSecret, pagePath, sessionId)
    }
  }

  async send (measurementId, apiSecret, pagePath, sessionId) {
    debug('Processing post request for page: \n%s ', pagePath)
    // Don't await the request - the api always returns a 200 (even on error) and we don't want to block the server request being handled.
    wreck
      .request('post', `https://www.google-analytics.com/mp/collect?api_secret=${apiSecret}&measurement_id=${measurementId}`, {
        agent: this._agent,
        payload: {
          client_id: sessionId,
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
        timeout: 1000
      })
      .then(() => {
        debug('Completed request to google analytics measurement protocol API')
      })
  }
}
