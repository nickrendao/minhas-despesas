process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://fin:fin_dev_pw@localhost:5432/fin_test';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
process.env.MAIL_MODE = 'console';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.CORS_ORIGINS = 'http://localhost:3000';
