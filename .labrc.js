module.exports = {
  paths: ['test/'],
  coverage: true,
  'coverage-all': true,
  lint: true,
  verbose: true,
  threshold: 85,
  reporter: ['console', 'html', 'lcov'],
  output: ['stdout', 'coverage/coverage.html', 'coverage/lcov.info']
}
