const wreck = require('@hapi/wreck')
const HttpsProxyAgent = require('https-proxy-agent')
const debug = require('debug')('hapi-gapi')
const ipAnonymise = require('ip-anonymize')
const Joi = require('@hapi/joi')

const getBatchInterval = () => process.env.HAPI_GAPI_BATCH_INTERVAL || 15000
const getBatchSize = () => process.env.HAPI_GAPI_BATCH_SIZE || 20
const MAX_QUEUE_TIME = 14400000

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
    },
    batchSize = getBatchSize(),
    batchInterval = getBatchInterval()
  }) {
    this._propertySettings = propertySettings
    this._sessionIdProducer = sessionIdProducer
    this._attributionProducer = attributionProducer
    this._hitBuffer = []
    this._batchSize = Math.min(Math.max(1, batchSize), 20)
    this._batchInterval = Math.min(Math.max(1000, batchInterval), 60000)
    if (this._batchSize > 1) {
      this._heartbeat = setInterval(this.send.bind(this), this._batchInterval)
    }
    const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
    this._agent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined
  }

  ga (request) {
    return {
      pageView: additionalPayload => this.hit('pageview', request, { t: 'pageview', ...additionalPayload }),

      event: async ({ category, action, label, value }) => {
        if (!category || !action) {
          throw new Error('Event tracking requires that the category and action parameters are non-empty')
        }
        await this.hit('event', request, { t: 'event', ec: category, ea: action, el: label, ev: value })
      },

      ecommerce: () => {
        const toMp = (products, params = {}) => {
          const mp = products.reduce((acc, val, idx) => {
            const mpProd = {
              [`pr${idx + 1}id`]: val.id,
              [`pr${idx + 1}nm`]: val.name,
              [`pr${idx + 1}br`]: val.brand,
              [`pr${idx + 1}ca`]: val.category,
              [`pr${idx + 1}va`]: val.variant,
              [`pr${idx + 1}qt`]: val.quantity,
              [`pr${idx + 1}pr`]: val.price.toFixed(2)
            }
            acc.ev = acc.ev += val.price
            return Object.assign(acc, mpProd)
          }, Object.assign({ t: 'event', ni: '1', ec: 'ecommerce', ev: 0.0 }, params))
          // Event values must be an integer
          mp.ev = Math.floor(mp.ev)
          return mp
        }

        return {
          detail: products => this.hit('ecommerce', request, toMp(products, { pa: 'detail', ea: 'productView' })),
          add: products => this.hit('ecommerce', request, toMp(products, { pa: 'add', ea: 'addToCart' })),
          remove: products => this.hit('ecommerce', request, toMp(products, { pa: 'remove', ea: 'removeFromCart' })),
          checkout: (products, step = null, option = null) =>
            this.hit('ecommerce', request, toMp(products, { pa: 'checkout', ea: 'checkout', cos: step, col: option })),
          purchase: (products, transactionId, affiliation = null) =>
            this.hit('ecommerce', request, toMp(products, { pa: 'purchase', ea: 'purchase', ti: transactionId, ta: affiliation })),
          refund: (products, transactionId) =>
            this.hit('ecommerce', request, toMp(products, { pa: 'refund', ea: 'refund', ti: transactionId }))
        }
      }
    }
  }

  async hit (type, request, payload) {
    if (this._propertySettings.length === 0) {
      return
    }
    const sessionId = await this._sessionIdProducer(request)
    const attribution = (await this._attributionProducer(request)) || {}
    if (Object.keys(attribution).length > 0) {
      const validationResult = attributionSchema.validate(attribution)
      if (validationResult.error) {
        console.warn('Attribution should contain campaign and one of source or id')
      }
    }

    for (const property of this._propertySettings) {
      if (!property.hitTypes.includes(type)) {
        continue
      }

      this._hitBuffer.push({
        timestamp: Date.now(),
        hit: Object.assign(
          {
            v: 1,
            tid: property.id,
            cid: sessionId,
            aip: 1,
            uip: ipAnonymise(request.info.remoteAddress),
            ds: 'web',
            dh: request.headers.host,
            dr: request.headers.referrer,
            ua: request.headers['user-agent'],
            dp: request.path,
            cn: attribution.campaign,
            cs: attribution.source,
            cm: attribution.medium,
            cc: attribution.content,
            ck: attribution.term
          },
          payload
        )
      })
    }

    if (this._hitBuffer.length >= this._batchSize) {
      await this.send()
    }
  }

  async send () {
    while (this._hitBuffer.length > 0) {
      const batch = this._hitBuffer.splice(0, this._batchSize)
      const payload = batch
        .map(e => {
          // Calculate the queue time (relative from now to the time that the hit was recorded)
          e.hit.qt = Math.min(Date.now() - e.timestamp, MAX_QUEUE_TIME)
          return encodeURI(
            Object.entries(e.hit)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(pair => pair.join('='))
              .join('&')
          )
        })
        .join('\n')
      debug('Processing buffered payload: \n%s', payload)
      // Don't await the request - the api always returns a 200 (even on error) and we don't want to block the server request being handled.
      wreck.request('post', 'https://www.google-analytics.com/batch', { agent: this._agent, payload: payload, timeout: 15000 }).then(() => {
        debug('Completed request to google analytics measurement protocol API')
      })
    }
  }

  async shutdown () {
    clearInterval(this._heartbeat)
    await this.send()
  }
}
