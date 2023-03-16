const Code = require('@hapi/code')
const Lab = require('@hapi/lab')
const sinon = require('sinon')
const { expect } = Code
const { afterEach, describe, it } = (exports.lab = Lab.script())
const wreck = require('@hapi/wreck')

const Analytics = require('../lib/analytics')
const querystring = require('querystring')

describe('Analytics', () => {
  it.only('creates a new analytics object', async () => {
    const anayticsObject = new Analytics({
      propertySettings: 'bleh'
    })
    expect(anayticsObject).to.be.instanceof(Analytics)
  })
})
