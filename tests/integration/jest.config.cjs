const path = require('node:path');
const api = path.resolve(__dirname, '../../apps/api');

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['**/*.e2e-spec.ts'],
  moduleDirectories: ['node_modules', path.join(api, 'node_modules')],
  transform: {
    '^.+\\.ts$': [require.resolve('ts-jest', { paths: [api] }), {
      tsconfig: {
        baseUrl: api,
        paths: { '@prisma/client': ['node_modules/@prisma/client'] },
        typeRoots: [path.join(api, 'node_modules/@types')],
        types: ['node', 'jest'],
      },
    }],
  },
};
