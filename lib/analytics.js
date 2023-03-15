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
      pageView: additionalPayload => this.hit('page_view', request, { t: 'page_view', ...additionalPayload }),
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
    console.log('payload', payload)
    console.log('request', request)
    console.log('Type', type)
    if (this._propertySettings.length === 0) {
      console.log('propertySettings equals 0')
      return
    }
    // const sessionId = await this._sessionIdProducer(request)
    const attribution = (await this._attributionProducer(request)) || {}
    if (Object.keys(attribution).length > 0) {
      console.log('attribution equals 0')
      const validationResult = attributionSchema.validate(attribution)
      if (validationResult.error) {
        console.warn('Attribution should contain campaign and one of source or id')
      }
    }
    console.log('sending')
    await this.send()
  }

  async send () {
    console.log('debug')
    debug('Processing buffered payload: \n%s')
    // Don't await the request - the api always returns a 200 (even on error) and we don't want to block the server request being handled.
    wreck
      .request('post', 'https://www.google-analytics.com/mp/collect?api_secret=sYC5IKb6RT-rdeu4D6JJ4A&measurement_id=G-DJMSHRPMW8', {
        agent: this._agent,
        payload: {
          client_id: '1234',
          user_id: '4321',
          events: [
            {
              name: 'removed_mapping',
              params: {
                page_view: 'True'
              }
            }
          ]
        },
        timeout: 0
      })
      .then(() => {
        console.log('done and done')
        debug('Completed request to google analytics measurement protocol API')
      })
  }

  async shutdown () {
    clearInterval(this._heartbeat)
    await this.send()
  }
}
