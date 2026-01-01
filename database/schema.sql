-- Serikat Database Schema
-- Run this script to create all necessary tables

CREATE DATABASE IF NOT EXISTS serikat_db;
USE serikat_db;

-- Users Table (Members & Admin)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    photo VARCHAR(255),
    role ENUM('member', 'admin') DEFAULT 'member',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    member_id VARCHAR(20) UNIQUE,
    nias VARCHAR(50) UNIQUE,
    card_generated_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Site Settings Table
CREATE TABLE IF NOT EXISTS site_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('text', 'textarea', 'image') DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Gallery Table
CREATE TABLE IF NOT EXISTS gallery (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    image VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- News Table
CREATE TABLE IF NOT EXISTS news (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    image VARCHAR(255),
    is_published BOOLEAN DEFAULT FALSE,
    views INT DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Member Cards Table
CREATE TABLE IF NOT EXISTS member_cards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    card_number VARCHAR(20) NOT NULL,
    card_image VARCHAR(255),
    valid_from DATE,
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert Default Site Settings
INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES
('site_name', 'Serikat', 'text'),
('site_tagline', 'Bersatu Untuk Kemajuan Bersama', 'text'),
('hero_title', 'Selamat Datang di Serikat', 'text'),
('hero_subtitle', 'Platform keanggotaan modern untuk komunitas yang solid', 'textarea'),
('hero_image', '/images/hero-bg.jpg', 'image'),
('about_title', 'Tentang Kami', 'text'),
('about_content', 'Serikat adalah organisasi yang berkomitmen untuk memajukan kesejahteraan anggota melalui berbagai program dan kegiatan yang bermanfaat. Kami percaya bahwa dengan bersatu, kita dapat mencapai tujuan bersama dengan lebih efektif.', 'textarea'),
('about_image', '/images/about.jpg', 'image'),
('footer_address', 'Jl. Contoh No. 123, Jakarta', 'text'),
('footer_phone', '021-12345678', 'text'),
('footer_email', 'info@serikat.id', 'text'),
('footer_copyright', '© 2024 Serikat. All rights reserved.', 'text')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Create Default Admin Account (password: admin123)
INSERT INTO users (phone, password, name, email, role, status, member_id) VALUES
('081234567890', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.Y.HLbKF.yLynFvlWO.', 'Administrator', 'admin@serikat.id', 'admin', 'approved', 'ADM001')
ON DUPLICATE KEY UPDATE name = VALUES(name);
