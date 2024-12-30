/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            jestCommandLine: 'jest', // Explicitly specify the Jest command
        },
    },
};