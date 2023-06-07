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
    debug('Processing post request for page: \n%s ', metrics.params.page_title)
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

  async sendEvent (events, measurementId, apiSecret, sessionId, pagePath) {
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
