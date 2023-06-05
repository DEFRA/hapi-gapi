const wreck = require('@hapi/wreck')
const HttpsProxyAgent = require('https-proxy-agent')
const debug = require('debug')('hapi-gapi')
const fetch = require('node-fetch')
module.exports = class Analytics {
  constructor ({ propertySettings, sessionIdProducer }) {
    this._propertySettings = propertySettings
    this._sessionIdProducer = sessionIdProducer
    const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
    this._agent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined
  }

  ga (request) {
    return {
      pageView: () => this.hit(request),
      view: (request, metrics) => this.view(request, metrics)
    }
  }

  async hit (request) {
    if (this._propertySettings.length === 0) {
      debug('No property settings')
      return
    }
    const pagePath = request.route.fingerprint
    const sessionId = await this._sessionIdProducer(request)

    this._propertySettings.forEach(async propertySetting => {
      const measurementId = propertySetting.id
      const apiSecret = propertySetting.key
      await this.send(measurementId, apiSecret, pagePath, sessionId)
    })
  }

  async view (request, metrics) {
    console.log('here: ', 'YOOOOOO!! VIEWWW!')
    if (this._propertySettings.length === 0) {
      debug('No property settings')
      return
    }
    const sessionId = await this._sessionIdProducer(request)
    console.log('here: METRICS ', metrics)
    this._propertySettings.forEach(async propertySetting => {
      const measurementId = propertySetting.id
      const apiSecret = propertySetting.key
      const pagePath = request.route.fingerprint
      await this.sendEvent(metrics, measurementId, apiSecret, sessionId, pagePath)
    })
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

  async sendEvent (events, measurementId, apiSecret, sessionId, pagePath) {
    console.log('STUFF: ', measurementId, apiSecret, sessionId, pagePath)
    fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'sessionId',
        user_id: 'sessionId',
        events: events // array of events
      })
    }).then(res => console.log('Completed request to google analytics measurement protocol API', res.status, res.statusText))
      .catch(err => console.error('Error sending GA request:', err))
  }
}
