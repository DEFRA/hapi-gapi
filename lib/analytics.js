const wreck = require('@hapi/wreck')
const BATCH_INTERVAL = process.env.HAPI_GAPI_BATCH_INTERVAL || 15000
const BATCH_SIZE = process.env.HAPI_GAPI_BATCH_SIZE || 20
const MAX_QUEUE_TIME = 14400000
const debug = require('debug')('hapi-gapi')

module.exports = class Analytics {
  constructor ({ gaPropertyId, sessionIdProducer, attributionProducer = () => {}, batchSize = BATCH_SIZE, batchInterval = BATCH_INTERVAL }) {
    this._gaPropertyId = gaPropertyId
    this._sessionIdProducer = sessionIdProducer
    this._attributionProducer = attributionProducer
    this._hitBuffer = []
    this._batchSize = Math.min(Math.max(1, batchSize), 20)
    this._batchInterval = Math.min(Math.max(1000, batchInterval), 60000)
    if (this._batchSize > 1) this._heartbeat = setInterval(this.send.bind(this), this._batchInterval)
  }

  ga (request) {
    return {
      pageView: () => this.hit(request, { t: 'pageview' }),

      event: async ({ category, action, label, value }) => {
        if (!category || !action) throw new Error('Event tracking requires that the category and action parameters are non-empty')
        await this.hit(request, { t: 'event', ec: category, ea: action, el: label, ev: value })
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
          }, Object.assign({ ec: 'ecommerce', ev: 0.0 }, params))
          mp.ev = mp.ev.toFixed(2)
          return mp
        }

        return {
          detail: (products) => this.hit(request, toMp(products, { pa: 'detail', ea: 'productView' })),
          add: (products) => this.hit(request, toMp(products, { pa: 'add', ea: 'addToCart' })),
          remove: (products) => this.hit(request, toMp(products, { pa: 'remove', ea: 'removeFromCart' })),
          checkout: (products, step = null, option = null) => this.hit(request, toMp(products, { pa: 'checkout', ea: 'checkout', cos: step, col: option })),
          purchase: (products, transactionId, affiliation = null) => this.hit(request, toMp(products, { pa: 'purchase', ea: 'purchase', ti: transactionId, ta: affiliation })),
          refund: (products, transactionId) => this.hit(request, toMp(products, { pa: 'refund', ea: 'refund', ti: transactionId }))
        }
      }
    }
  }

  async hit (request, payload) {
    const attribution = await this._attributionProducer(request) || {}

    const pl = Object.assign({
      v: 1,
      tid: this._gaPropertyId,
      cid: await this._sessionIdProducer(request),
      aip: 1,
      ds: 'web',
      dh: request.headers.host,
      dr: request.headers.referrer,
      ua: request.headers['user-agent'],
      dp: request.path,
      dt: request.path, // TODO: dt should be page title
      cn: attribution.campaign,
      cs: attribution.source,
      cm: attribution.medium,
      cc: attribution.content,
      ck: attribution.term
    }, payload)

    this._hitBuffer.push({ timestamp: Date.now(), hit: pl })
    if (this._hitBuffer.length >= this._batchSize) {
      this.send()
    }
  }

  async send () {
    while (this._hitBuffer.length > 0) {
      const batch = this._hitBuffer.splice(0, this._batchSize)
      const payload = batch.map((e) => {
        // Calculate the queue time (relative from now to the time that the hit was recorded)
        e.hit.qt = Math.min(Date.now() - e.timestamp, MAX_QUEUE_TIME)
        return encodeURI(Object.entries(e.hit).filter(([, v]) => v !== undefined && v !== null).map(e => e.join('=')).join('&'))
      }).join('\n')
      debug('Processing buffered payload: %s', payload)
      await wreck.request('post', 'https://www.google-analytics.com/batch', { payload: payload, timeout: 15000 })
    }
  }

  async shutdown () {
    clearInterval(this._heartbeat)
    await this.send()
  }
}
