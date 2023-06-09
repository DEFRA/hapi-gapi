module.exports = {
	collectCoverage: true,
	collectCoverageFrom: [
		'**/*.js',
		'!**/*.test.js'
	],
	coverageDirectory: 'coverage',
	coverageReporters: [
		'text-summary',
		'lcov'
	],
	coveragePathIgnorePatterns: [
		'<rootDir>/node_modules/',
		'<rootDir>/coverage/',
		'<rootDir>/test/',
		'<rootDir>/jest.config.js'
	],
	modulePathIgnorePatterns: [
		'node_modules'
	],
	testEnvironment: 'node',
	testPathIgnorePatterns: [],
	verbose: true,
}
