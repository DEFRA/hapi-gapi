# hapi-gapi

[![Build Status](https://travis-ci.org/DEFRA/hapi-gapi.svg?branch=master)](https://travis-ci.org/DEFRA/hapi-gapi)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=alert_status)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=security_rating)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=ncloc)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=coverage)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=bugs)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=code_smells)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=sqale_index)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-gapi&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=DEFRA_hapi-gapi)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Dependabot](https://api.dependabot.com/badges/status?host=github&repo=DEFRA/hapi-gapi)](https://dependabot.com/)
[![GitHub issues](https://img.shields.io/github/issues/DEFRA/hapi-gapi.svg)](https://github.com/DEFRA/rod-licensing/issues/)
[![Code size](https://img.shields.io/github/languages/code-size/DEFRA/hapi-gapi.svg)]()
[![Repo size](https://img.shields.io/github/repo-size/DEFRA/hapi-gapi.svg)]()
[![Licence](https://img.shields.io/badge/Licence-OGLv3-blue.svg)](http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3)

hapi google analytics platform integration

## Cloning

Cloning via SSH from behind a firewall which blocks port 22:

```
git clone ssh://git@ssh.github.com:443/DEFRA/hapi-gapi
```

## Installing the plugin

```
npm install --save @defra/hapi-gapi
```

## Registering the plugin with hapi

```javascript
const Hapi = require('@hapi/hapi')
const HapiGapi = require('@defra/hapi-gapi')

const server = Hapi.server({
  host: 'localhost',
  port: 3000
})

await server.register({
  plugin: HapiGapi,
  options: {
    propertySettings: [
      {
        id: 'UA-XXXXXX-XX',
        hitTypes: ['pageview', 'event', 'ecommerce']
      },
      {
        id: 'UA-YYYYYY-YY',
        hitTypes: ['pageview']
      }
    ],
    sessionIdProducer: async request => {
      // Would normally use the request object to retrieve the proper session identifier
      return 'test-session'
    },
    attributionProducer: async request => {
      // Would normally use the request object to return any attribution associated with the user's session
      return {
        campaign: 'attribution_campaign',
        source: 'attribution_source',
        medium: 'attribution_medium',
        content: 'attribution_content',
        term: 'attribution_term'
      }
    },
    batchSize: 20,
    batchInterval: 15000
  }
})

await server.start()

// Ensure server.stop is called on interrupts so that buffered hits are sent to the Google Measurement Protocol API before shutdown
const shutdown = async (code = 0) => {
  await server.stop()
  process.exit(code)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

| Option              | Description                                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| propertySettings    | Defines the Google Analytics properties and the type of hits which are allowed to be sent to each. If empty, analytics data is not recorded (useful if you want to enable/disable via environment variables but still want the request decorated) |
| sessionIdProducer   | A method to retrieve an identifier to differentiate each user session                                                                                                                                                                             |
| attributionProducer | (Optional) A method to retrieve any attribution associated with the user session to enable campaign tracking as per https://support.google.com/analytics/answer/1033863?hl=en                                                                     |
| batchSize           | (Optional) The maximum number of hits to buffer before sending a request to the Google Analytics API. 20 is the maximum number of hits that the API will accept in batch                                                                          |
| batchInterval       | (Optional) The maximum time (in ms) before sending any recorded hits to the Google Analytics API.                                                                                                                                                 |

## How to use

This plugin decorates the request object so that you can easily send data to Google Analytics as per the following examples:

### Page views

```javascript
await request.ga.pageView()
```

**NOTE: By default this is not necessary, the plugin will automatically send page-views by hooking into the onPreResponse lifecycle hook**

### Events

```javascript
await request.ga.event({
  category: 'Event category',
  action: 'Event action',
  label: 'Event label',
  value: 123
})
```

> The label and value arguments are optional

### Enhanced Ecommerce

```javascript
const products = [
  {
    id: 'product1',
    name: 'product1name',
    brand: 'product1brand',
    category: 'product1category',
    variant: 'product1variant',
    quantity: 1,
    price: 123.45
  }
]
// Send a product view
await request.ga.ecommerce().detail(products)
// Add to cart
await request.ga.ecommerce().add(products)
// Commence checkout - second two parameters (step number and option) are optional
await request.ga.ecommerce().checkout(products, 1, 'Visa')
// Purchase (affiliation is optional)
await request.ga.ecommerce().purchase(products, 'transaction-identifier', 'affiliation')
```

## Contributing to this project

If you have an idea you'd like to contribute please log an issue.

All contributions should be submitted via a pull request.

## License

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the license

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable information providers in the public sector to license the use and re-use of their information under a common open licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
