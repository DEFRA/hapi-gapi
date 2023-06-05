const wreck = require('@hapi/wreck')
const HttpsProxyAgent = require('https-proxy-agent')
const debug = require('debug')('hapi-gapi')
const fetch = require('node-fetch')
module.exports = class Analytics {
  constructor ({ propertySettings, sessionIdProducer }) {
    // console.log('here: ', 'YOOOOOO!!constructor')
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
    console.log('here: ', 'YOOOOOO!! HIIIIT!')
    if (this._propertySettings.length === 0) {
      debug('No property settings')
      return
    }
    const pagePath = request.route.fingerprint
    const sessionId = await this._sessionIdProducer(request)

    this._propertySettings.forEach(async propertySetting => {
      console.log('here: ', 'YOOOOOO!!')
      const measurementId = propertySetting.id
      const apiSecret = propertySetting.key
      await this.send(measurementId, apiSecret, pagePath, sessionId)
    })
    // refactor this to use forEach instead
    // for (let x = 0; x < this._propertySettings.length; x++) {
    //   const measurementId = this._propertySettings[x].id
    //   const apiSecret = this._propertySettings[x].key
    //   await this.send(measurementId, apiSecret, pagePath, sessionId)
    // }
    }

  async view (request, metrics) {
    console.log('here: ', 'YOOOOOO!! VIEWWW!')
    if (this._propertySettings.length === 0) {
      debug('No property settings')
      return
    }
    // const pagePath = request.route.fingerprint
    const sessionId = await this._sessionIdProducer(request)
    console.log('here: METRICS ', metrics)
    this._propertySettings.forEach(async propertySetting => {
      // console.log('here: ', 'YOOOOOO!!')
      const measurementId = propertySetting.id
      const apiSecret = propertySetting.key
      // const events = metrics.map((metric) => {
      //   return this.createEvents(metric)
      // })
      const pagePath = request.route.fingerprint
      await this.sendEvent(metrics, measurementId, apiSecret, sessionId, pagePath)
    })
    // refactor this to use forEach instead
    // for (let x = 0; x < this._propertySettings.length; x++) {
    //   const measurementId = this._propertySettings[x].id
    //   const apiSecret = this._propertySettings[x].key
    //   await this.send(measurementId, apiSecret, pagePath, sessionId)
    // }
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
    const eventsArray = events.map((event) => {
      return this.createEvent(event)
    })
    console.log('YOOOOOOO eventsArray: ', eventsArray)
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

  createEvent (event) {
    const e = {
      name: event.name,
      // name: 'DEBUGGGGGG',
      params: {
        ...(event.params.user_type && { user_type: event.params.user_type }),
        ...(event.params.eligibility && { eligibility: event.params.eligibility }),
        ...(event.params.final_eligibility && { final_eligibility: event.params.final_eligibility }),
        ...(event.params.elimination_time && { elimination_time: event.params.elimination_time }),
        ...(event.params.eligibility_time && { eligibility_time: event.params.eligibility_time }),
        ...(event.params.journey_continued && { journey_continued: event.params.journey_continued }),
        ...(event.params.page_location && { page_location: event.params.page_location }),
        ...(event.params.page_title && { page_title: event.params.page_title }),
        ...(event.params.grant_type && { grant_type: event.params.grant_type }),
        ...(event.params.score && { score: event.params.score }),
        ...(event.params.score_presented && { score_presented: event.params.score_presented }),
        ...(event.params.score_time && { score_time: event.params.score_time })
      }
    }
    console.log('YOOOOOOO e after conversion:: ', e)
    return e
  }
}
