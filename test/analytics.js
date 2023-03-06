const Code = require('@hapi/code')
const Lab = require('@hapi/lab')
const sinon = require('sinon')
const { expect } = Code
const { afterEach, describe, it } = (exports.lab = Lab.script())
const wreck = require('@hapi/wreck')

const Analytics = require('../lib/analytics')
const querystring = require('querystring')

const TEST_PROPERTY_SETTINGS = [
  {
    id: 'UA-XXXXXX',
    hitTypes: ['page_view', 'event', 'ecommerce']
  }
]
const TEST_SESSION = () => 'test-session'
const TEST_NO_ATTRIBUTION = () => null
const ECOMMERCE_TEST_PRODUCTS = [
  {
    id: 'product1',
    name: 'product1name',
    brand: 'product1brand',
    category: 'product1category',
    variant: 'product1variant',
    quantity: 1,
    price: 1.1
  },
  {
    id: 'product2',
    name: 'product2name',
    brand: 'product2brand',
    category: 'product2category',
    variant: 'product2variant',
    quantity: 2,
    price: 2.2
  }
]
const DEFAULT_REQUEST_OBJ = {
  headers: {
    host: 'example.com',
    referrer: 'anothersite.com',
    'user-agent': 'Mozilla'
  },
  info: {
    remoteAddress: '127.0.0.1'
  },
  path: '/some/endpoint'
}

const TEST_DEFAULT_ATTRIBUTION = request => {
  expect(request).to.be.an.object()
  expect(request.path).to.be.a.string()
  expect(request.headers).to.be.an.object()
  expect(request.headers.host).to.be.a.string()
  expect(request.headers.referrer).to.be.a.string()
  expect(request.headers['user-agent']).to.be.a.string()

  return {
    campaign: 'attribution_campaign',
    source: 'attribution_source',
    medium: 'attribution_medium',
    content: 'attribution_content',
    term: 'attribution_term'
  }
}

const testDefaultHitAssertions = (method, url, options) => {
  const hit = querystring.parse(options.payload)
  expect(method).to.equal('post')
  expect(url).to.equal('https://www.google-analytics.com/batch')
  expect(hit.v).to.equal('1')
  expect(hit.tid).to.equal(TEST_PROPERTY_SETTINGS[0].id)
  expect(hit.aip).to.equal('1')
  expect(hit.ds).to.equal('web')
  expect(hit.dh).to.equal('example.com')
  expect(hit.dr).to.equal('anothersite.com')
  expect(hit.ua).to.equal('Mozilla')
  expect(hit.dp).to.equal('/some/endpoint')
  return hit
}

const testDefaultEcommerceProductAssertions = (hit, eventAction) => {
  expect(hit.ec).to.equal('ecommerce')
  expect(hit.ea).to.equal(eventAction)
  expect(hit.ev).to.equal(String(Math.floor(ECOMMERCE_TEST_PRODUCTS[0].price + ECOMMERCE_TEST_PRODUCTS[1].price)))
  expect(hit.pr1id).to.equal(ECOMMERCE_TEST_PRODUCTS[0].id)
  expect(hit.pr1nm).to.equal(ECOMMERCE_TEST_PRODUCTS[0].name)
  expect(hit.pr1br).to.equal(ECOMMERCE_TEST_PRODUCTS[0].brand)
  expect(hit.pr1ca).to.equal(ECOMMERCE_TEST_PRODUCTS[0].category)
  expect(hit.pr1va).to.equal(ECOMMERCE_TEST_PRODUCTS[0].variant)
  expect(hit.pr1qt).to.equal(String(ECOMMERCE_TEST_PRODUCTS[0].quantity))
  expect(hit.pr1pr).to.equal(ECOMMERCE_TEST_PRODUCTS[0].price.toFixed(2))
  expect(hit.pr2id).to.equal(ECOMMERCE_TEST_PRODUCTS[1].id)
  expect(hit.pr2nm).to.equal(ECOMMERCE_TEST_PRODUCTS[1].name)
  expect(hit.pr2br).to.equal(ECOMMERCE_TEST_PRODUCTS[1].brand)
  expect(hit.pr2ca).to.equal(ECOMMERCE_TEST_PRODUCTS[1].category)
  expect(hit.pr2va).to.equal(ECOMMERCE_TEST_PRODUCTS[1].variant)
  expect(hit.pr2qt).to.equal(String(ECOMMERCE_TEST_PRODUCTS[1].quantity))
  expect(hit.pr2pr).to.equal(ECOMMERCE_TEST_PRODUCTS[1].price.toFixed(2))
  return hit
}

describe('Analytics', () => {
  afterEach(() => {
    sinon.restore()
  })

  it('handles page views', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_NO_ATTRIBUTION,
      batchSize: 1
    })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.cn).to.not.exist()
      expect(hit.cs).to.not.exist()
      expect(hit.cm).to.not.exist()
      expect(hit.cc).to.not.exist()
      expect(hit.ck).to.not.exist()
      expect(hit.t).to.equal('page_view')
      expect(hit.qt).to.be.at.most(100)
    })

    analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
  })

  it('session id producer is not called if propertySettings is empty', () => {
    const sessionIdProducer = sinon.spy(r => {})
    const analytics = new Analytics({
      propertySettings: [],
      sessionIdProducer,
      attributionProducer: r => {}
    })
    analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
    expect(sessionIdProducer.callCount).to.equal(0)
  })

  it('attribution producer is not called if propertySettings is empty', () => {
    const attributionProducer = sinon.spy(r => {})
    const analytics = new Analytics({
      propertySettings: [],
      sessionIdProducer: r => {},
      attributionProducer
    })
    analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
    expect(attributionProducer.callCount).to.equal(0)
  })
  ;[
    { desc: 'campaign and source specified', test: { campaign: 'cn1', source: 'cs' }, res: true },
    { desc: 'campaign and id specified', test: { campaign: 'cn2', id: 'cid2' }, res: true },
    { desc: 'campaign omitted', test: { source: 'cs', id: 'cid3' }, res: false },
    { desc: 'source and id omitted', test: { campaign: 'cn1' }, res: false },
    { desc: 'campaign specified but zero length', test: { campaign: '', source: 'cs' }, res: false },
    { desc: 'campaign specified but just spaces', test: { campaign: '   ', source: 'cs' }, res: false },
    { desc: 'source specified but zero length', test: { campaign: 'cn1', source: '' }, res: false },
    { desc: 'source specified but just spaces', test: { campaign: 'cn1', source: '   ' }, res: false },
    { desc: 'id specified but zero length', test: { campaign: 'cn1', id: '' }, res: false },
    { desc: 'id specified but just spaces', test: { campaign: 'cn1', id: '   ' }, res: false }
  ].forEach(({ desc, test, res }) => {
    it(`validates that return value of attribution producer has a cn value and one of cm or cs (${desc})`, async () => {
      const attributionProducer = () => test
      const analytics = new Analytics({
        propertySettings: TEST_PROPERTY_SETTINGS,
        sessionIdProducer: r => {},
        attributionProducer
      })
      sinon.spy(console, 'warn')
      if (res) {
        await analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
        expect(console.warn.calledWith('Attribution should contain campaign and one of source or id')).to.equal(false)
      } else {
        await analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
        expect(console.warn.calledWith('Attribution should contain campaign and one of source or id')).to.equal(true)
      }
    })
  })

  it('handles page views with attribution', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.cn).to.equal('attribution_campaign')
      expect(hit.cs).to.equal('attribution_source')
      expect(hit.cm).to.equal('attribution_medium')
      expect(hit.cc).to.equal('attribution_content')
      expect(hit.ck).to.equal('attribution_term')
      expect(hit.t).to.equal('page_view')
      expect(hit.qt).to.be.at.most(100)
    })

    analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
  })

  it('sends additional data for page views', async () => {
    const additionalData = {
      a: 1,
      b: 'two',
      c: false
    }
    const encodedAdditionalData = 'a=1&b=two&c=false'
    const wreckSpy = sinon.spy(wreck, 'request')
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    await analytics.ga(DEFAULT_REQUEST_OBJ).pageView(additionalData)
    expect(wreckSpy.args[0][2].payload.includes(encodedAdditionalData)).to.be.true()
  })

  it('uses agent if https_proxy environment variable is defined', async () => {
    sinon.stub(process, 'env').value({ https_proxy: 'some value' })

    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      expect(options.agent).to.exist()
    })

    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_NO_ATTRIBUTION,
      batchSize: 1
    })

    analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
  })

  it('uses agent if HTTPS_PROXY environment variable is defined', async () => {
    sinon.stub(process, 'env').value({ HTTPS_PROXY: 'some-other-value' })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      expect(options.agent.proxy.path).to.equal('some-other-value')
    })

    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_NO_ATTRIBUTION,
      batchSize: 1
    })

    analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
  })

  it('does not use agent if https_proxy environment variable is not defined', async () => {
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      expect(options.agent).to.not.exist()
    })

    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_NO_ATTRIBUTION,
      batchSize: 1
    })

    analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
  })

  it('handles events', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })

    const testEvent = {
      category: 'event_category',
      action: 'event_action',
      label: 'event_label',
      value: 123
    }

    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.ec).to.equal(testEvent.category)
      expect(hit.ea).to.equal(testEvent.action)
      expect(hit.el).to.equal(testEvent.label)
      expect(hit.ev).to.equal(String(testEvent.value))
      expect(hit.t).to.equal('event')
      expect(hit.qt).to.be.at.most(100)
    })

    analytics.ga(DEFAULT_REQUEST_OBJ).event(testEvent)
  })

  it('throws on invalid events', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    expect(
      analytics.ga(DEFAULT_REQUEST_OBJ).event({
        category: 'event_category',
        action: null
      })
    ).reject()
    expect(
      analytics.ga(DEFAULT_REQUEST_OBJ).event({
        category: null,
        action: 'event_action'
      })
    ).reject()
  })

  it('handles enhanced ecommerce product detail views', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.pa).to.equal('detail')
      testDefaultEcommerceProductAssertions(hit, 'productView')
    })
    analytics
      .ga(DEFAULT_REQUEST_OBJ)
      .ecommerce()
      .detail(ECOMMERCE_TEST_PRODUCTS)
  })

  it('handles enhanced ecommerce product add to cart', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.pa).to.equal('add')
      testDefaultEcommerceProductAssertions(hit, 'addToCart')
    })
    analytics
      .ga(DEFAULT_REQUEST_OBJ)
      .ecommerce()
      .add(ECOMMERCE_TEST_PRODUCTS)
  })

  it('handles enhanced ecommerce product remove from cart', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.pa).to.equal('remove')
      testDefaultEcommerceProductAssertions(hit, 'removeFromCart')
    })
    analytics
      .ga(DEFAULT_REQUEST_OBJ)
      .ecommerce()
      .remove(ECOMMERCE_TEST_PRODUCTS)
  })

  it('handles enhanced ecommerce product checkouts', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.pa).to.equal('checkout')
      expect(hit.cos).to.equal('1')
      expect(hit.col).to.equal('visa')
      testDefaultEcommerceProductAssertions(hit, 'checkout')
    })
    analytics
      .ga(DEFAULT_REQUEST_OBJ)
      .ecommerce()
      .checkout(ECOMMERCE_TEST_PRODUCTS, 1, 'visa')
  })

  it('handles enhanced ecommerce product purchases', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.pa).to.equal('purchase')
      expect(hit.ti).to.equal('transactionId')
      expect(hit.ta).to.equal('affiliate_code')
      testDefaultEcommerceProductAssertions(hit, 'purchase')
    })
    analytics
      .ga(DEFAULT_REQUEST_OBJ)
      .ecommerce()
      .purchase(ECOMMERCE_TEST_PRODUCTS, 'transactionId', 'affiliate_code')
  })

  it('handles enhanced ecommerce product refunds', () => {
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_DEFAULT_ATTRIBUTION,
      batchSize: 1
    })
    sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
      const hit = testDefaultHitAssertions(method, url, options)
      expect(hit.pa).to.equal('refund')
      expect(hit.ti).to.equal('transactionId')
      testDefaultEcommerceProductAssertions(hit, 'refund')
    })
    analytics
      .ga(DEFAULT_REQUEST_OBJ)
      .ecommerce()
      .refund(ECOMMERCE_TEST_PRODUCTS, 'transactionId')
  })

  it('handles hits in batch', { timeout: 5000 }, () => {
    return new Promise(resolve => {
      const analytics = new Analytics({
        propertySettings: TEST_PROPERTY_SETTINGS,
        sessionIdProducer: TEST_SESSION,
        attributionProducer: TEST_NO_ATTRIBUTION,
        batchSize: 20,
        batchInterval: 1000
      })
      sinon.stub(wreck, 'request').callsFake(async (method, url, options) => {
        const hits = options.payload.split('\n')
        expect(hits).to.be.an.array()
        expect(hits).to.have.length(5)

        for (const hit of hits) {
          testDefaultHitAssertions(method, url, { payload: hit })
        }

        await analytics.shutdown()
        resolve()
      })

      for (let i = 0; i < 5; i++) {
        analytics.ga(DEFAULT_REQUEST_OBJ).pageView()
      }
    })
  })

  it('does not make unnecessary requests to the api', { timeout: 5000 }, () => {
    return new Promise(resolve => {
      const analytics = new Analytics({
        propertySettings: TEST_PROPERTY_SETTINGS,
        sessionIdProducer: TEST_SESSION,
        attributionProducer: TEST_NO_ATTRIBUTION,
        batchSize: 20,
        batchInterval: 1000
      })
      sinon.stub(wreck, 'request').callsFake(() => {
        Code.fail('Unexpected request to the google measurement protocol api, no hits queued!')
      })
      // Try to force a manual send
      analytics.send()
      // Wait a few seconds to allow the internal batch interval to fire
      setTimeout(resolve, 3000)
    })
  })
})

describe('analytics._batchInterval', () => {
  it('sets the batch interval to the HAPI_GAPI_BATCH_INTERVAL env variable if available', () => {
    sinon.stub(process, 'env').value({ HAPI_GAPI_BATCH_INTERVAL: 12000 })
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_NO_ATTRIBUTION
    })
    expect(analytics._batchInterval).to.equal(12000)
  })
  it('sets the batch interval to 15000 if not defined in env file', () => {
    sinon.stub(process, 'env').value({})
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_NO_ATTRIBUTION
    })
    expect(analytics._batchInterval).to.equal(15000)
  })
  it('sets the batch size to the HAPI_GAPI_BATCH_SIZE env variable if available', () => {
    sinon.stub(process, 'env').value({ HAPI_GAPI_BATCH_SIZE: 12 })
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_NO_ATTRIBUTION
    })
    expect(analytics._batchSize).to.equal(12)
  })
  it('sets the batch interval to 20 if not defined in env file', () => {
    sinon.stub(process, 'env').value({})
    const analytics = new Analytics({
      propertySettings: TEST_PROPERTY_SETTINGS,
      sessionIdProducer: TEST_SESSION,
      attributionProducer: TEST_NO_ATTRIBUTION
    })
    expect(analytics._batchSize).to.equal(20)
  })
})
