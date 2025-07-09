-- =============================================
-- USER SERVICE - Add Country Field Migration
-- =============================================

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table with country field
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(100) DEFAULT 'user',
    country VARCHAR(3), -- ISO 3166-1 alpha-3 country codes (TUR, USA, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add country field if table already exists but column doesn't
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'country'
    ) THEN
        ALTER TABLE users ADD COLUMN country VARCHAR(3);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data with countries for testing
INSERT INTO users (name, email, role, country) VALUES 
    ('Ahmet Yılmaz', 'ahmet@example.com', 'admin', 'TUR'),
    ('John Smith', 'john@example.com', 'user', 'USA'),
    ('Marie Dubois', 'marie@example.com', 'user', 'FRA'),
    ('Hans Mueller', 'hans@example.com', 'user', 'DEU'),
    ('Maria Garcia', 'maria@example.com', 'user', 'ESP'),
    ('Fatma Kaya', 'fatma@example.com', 'user', 'TUR'),
    ('Ali Demir', 'ali@example.com', 'user', 'TUR'),
    ('David Brown', 'david@example.com', 'moderator', 'GBR'),
    ('Paolo Rossi', 'paolo@example.com', 'user', 'ITA'),
    ('Yuki Tanaka', 'yuki@example.com', 'user', 'JPN')
ON CONFLICT (email) DO NOTHING; 