const isTest = process.env.NODE_ENV === 'test';

export const config = {
  port: Number(process.env.PORT || 4002),
  authServiceUrl: (process.env.AUTH_SERVICE_URL || 'http://localhost:4001').replace(/\/+$/, ''),
  dbPath: process.env.DB_PATH || (isTest ? ':memory:' : './data/transactions.db'),
};
