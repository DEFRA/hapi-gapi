const debug = require('debug')('hapi-gapi')
const axios = require('axios')
module.exports = class Analytics {
  constructor({ propertySettings, sessionIdProducer }) {
    this._propertySettings = propertySettings
    this._sessionIdProducer = sessionIdProducer
  }

  ga() {
    return {
      view: (_request, metrics) => this.view(_request, metrics)
    }
  }

  async view(request, metrics) {
    debug('Processing post request for Event: \n%s ', metrics.name)
    if (this._propertySettings.length === 0) {
      debug('No property settings')
      return
    }
    const sessionId = await this._sessionIdProducer(request)
    this._propertySettings.forEach(async propertySetting => {
      const measurementId = propertySetting.id
      const apiSecret = propertySetting.key
      await this.sendEvent(metrics, measurementId, apiSecret, sessionId)
    })
  }

  async sendEvent(events, measurementId, apiSecret, sessionId) {
    await axios.post(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        client_id: sessionId,
        user_id: sessionId,
        events: events // array of events
      }).then(res => console.log('Completed request to google analytics measurement protocol API', res.status, res.statusText))
      .catch(err => console.log('Error sending GA request:', err))
  }
}
