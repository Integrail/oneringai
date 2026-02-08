-- Seed initial super_admin user
-- Password: admin123! (CHANGE IN PRODUCTION)
-- Hash generated with PBKDF2-SHA256, 600K iterations
-- You should create the admin via the API instead:
--   curl -X POST http://localhost:8787/auth/signup -H 'Content-Type: application/json' \
--     -d '{"email":"admin@oneringai.com","password":"admin123!"}'
-- Then manually promote to super_admin:

-- After creating via API, run:
-- UPDATE users SET role = 'super_admin' WHERE email = 'admin@oneringai.com';
