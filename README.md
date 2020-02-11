# hapi-gapi
[![Build Status](https://travis-ci.org/DEFRA/hapi-gapi.svg?branch=master)](https://travis-ci.org/DEFRA/hapi-gapi)
[![Maintainability](https://api.codeclimate.com/v1/badges/182d4903d15c6d20fc20/maintainability)](https://codeclimate.com/github/DEFRA/hapi-gapi/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/182d4903d15c6d20fc20/test_coverage)](https://codeclimate.com/github/DEFRA/hapi-gapi/test_coverage)
[![Licence](https://img.shields.io/badge/Licence-OGLv3-blue.svg)](http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3)

hapi google analytics platform integration

## Cloning
Cloning via SSH from behind a firewall which blocks port 22:
```
git clone ssh://git@ssh.github.com:443/DEFRA/hapi-gapi
```

## Installing the plugin
Via github:
```
npm install --save https://github.com/DEFRA/hapi-gapi.git#master
```

To use a specific commit/version, install as follows:
```
npm install --save https://github.com/DEFRA/hapi-gapi.git#commit_or_version
```

## Registering the plugin with hapi
```javascript
const Hapi = require('@hapi/hapi')
const HapiGapi = require('hapi-gapi')

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
    sessionIdProducer: (request) => {
      // Would normally use the request object to retrieve the proper session identifier
      return 'test-session'
    },
    attributionProducer: (request) => {
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

## How to use
This plugin decorates the request object so that you can easily send data to Google Analytics as per the following examples:

### Page views
```javascript
request.ga.pageView()
```
__NOTE: By default this is not necessary, the plugin will automatically send page-views by hooking into the onPreResponse lifecycle hook__

### Events
```javascript
request.ga.event({
  category: 'Event category',
  action: 'Event action',
  label: 'Event label',
  value: 123
})
```

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
request.ga.ecommerce().detail(products)
// Add to cart
request.ga.ecommerce().add(products)
// Commence checkout - second two parameters (step number and option) are optional
request.ga.ecommerce().checkout(products, 1, 'Visa')
// Purchase (affiliation is optional)
request.ga.ecommerce().purchase(products, 'transaction-identifier', 'affiliation')
```

## Contributing to this project

If you have an idea you'd like to contribute please log an issue.

All contributions should be submitted via a pull request.

## License

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3

The following attribution statement MUST be cited in your products and applications when using this information.

>Contains public sector information licensed under the Open Government license v3

### About the license

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable information providers in the public sector to license the use and re-use of their information under a common open licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
