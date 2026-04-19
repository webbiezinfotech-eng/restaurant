-- Run schema.sql first, then this file if you need to re-seed only data
--
-- Login (any one username field works in the app):
--   Username: admin
--   Email:    admin@restaurant.com
--   Password: Admin@1234   (note the "4" at the end — not Admin@123)
--
INSERT IGNORE INTO `admin_users` (`username`, `email`, `password_hash`, `full_name`) VALUES
('admin', 'admin@restaurant.com', '$2y$12$U7v/u/DvN7Djyo5V/ntfS.fd0Ui7BKqjTd5e1uv.eYq7phZwCP8C.', 'System Administrator');

-- If you already imported the old broken hash, fix the password with:
-- UPDATE admin_users SET password_hash = '$2y$12$U7v/u/DvN7Djyo5V/ntfS.fd0Ui7BKqjTd5e1uv.eYq7phZwCP8C.' WHERE username = 'admin';
