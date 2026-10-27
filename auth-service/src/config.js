const isTest = process.env.NODE_ENV === 'test';

const jwtSecret = process.env.JWT_SECRET || (isTest ? 'test-secret-not-for-production' : null);
if (!jwtSecret || jwtSecret.length < 32 && !isTest) {
  throw new Error('JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.');
}

export const config = {
  port: Number(process.env.PORT || 4001),
  jwtSecret,
  tokenTtlSeconds: Number(process.env.TOKEN_TTL_SECONDS || 3600),
  dbPath: process.env.DB_PATH || (isTest ? ':memory:' : './data/auth.db'),
};
