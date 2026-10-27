const isTest = process.env.NODE_ENV === 'test';

export const config = {
  port: Number(process.env.PORT || 4004),
  authServiceUrl: (process.env.AUTH_SERVICE_URL || 'http://localhost:4001').replace(/\/+$/, ''),
  budgetsServiceUrl: (process.env.BUDGETS_SERVICE_URL || 'http://localhost:4003').replace(/\/+$/, ''),
  transactionsServiceUrl: (process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:4002').replace(/\/+$/, ''),
  dbPath: process.env.DB_PATH || (isTest ? ':memory:' : './data/notifications.db'),
};
