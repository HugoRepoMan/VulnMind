process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'vulnmind-integration-test-secret';
process.env.DATABASE_URL ||= 'postgresql://vulnmind:vulnmind_password@localhost:5432/vulnmind_db?schema=public';

process.argv = [
  process.argv[0],
  'jest',
  '--runInBand',
  ...process.argv.slice(2)
];

await import('../node_modules/jest/bin/jest.js');
