-- Order Service Database Initialization Script
-- This script creates the necessary database objects for the Order Service

-- Create database and user if they don't exist
-- Note: This might not work in Docker setup as the database and user are created by environment variables

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(100),
    notes TEXT,
    correlation_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('shipping', 'billing')),
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist and create new ones
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_correlation_id ON orders(correlation_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_addresses_order_id ON addresses(order_id);
CREATE INDEX IF NOT EXISTS idx_addresses_type ON addresses(type);

-- Insert sample data for testing (optional - remove in production)
INSERT INTO orders (id, user_id, status, total_amount, currency, payment_method, correlation_id) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'user001', 'pending', 99.99, 'USD', 'credit_card', 'test-correlation-001'),
    ('550e8400-e29b-41d4-a716-446655440002', 'user002', 'confirmed', 149.99, 'USD', 'paypal', 'test-correlation-002'),
    ('550e8400-e29b-41d4-a716-446655440003', 'user001', 'shipped', 79.99, 'USD', 'credit_card', 'test-correlation-003')
ON CONFLICT (id) DO NOTHING;

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'prod001', 2, 49.99),
    ('550e8400-e29b-41d4-a716-446655440002', 'prod002', 1, 149.99),
    ('550e8400-e29b-41d4-a716-446655440003', 'prod001', 1, 49.99),
    ('550e8400-e29b-41d4-a716-446655440003', 'prod003', 1, 29.99)
ON CONFLICT (id) DO NOTHING;

-- Insert sample addresses
INSERT INTO addresses (order_id, type, street, city, state, postal_code, country, zip_code, phone) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'shipping', '123 Main St', 'New York', 'NY', '10001', 'USA', '10001', '+1-555-0101'),
    ('550e8400-e29b-41d4-a716-446655440001', 'billing', '123 Main St', 'New York', 'NY', '10001', 'USA', '10001', '+1-555-0101'),
    ('550e8400-e29b-41d4-a716-446655440002', 'shipping', '456 Oak Ave', 'Los Angeles', 'CA', '90210', 'USA', '90210', '+1-555-0102'),
    ('550e8400-e29b-41d4-a716-446655440002', 'billing', '456 Oak Ave', 'Los Angeles', 'CA', '90210', 'USA', '90210', '+1-555-0102'),
    ('550e8400-e29b-41d4-a716-446655440003', 'shipping', '789 Pine Rd', 'Chicago', 'IL', '60601', 'USA', '60601', '+1-555-0103'),
    ('550e8400-e29b-41d4-a716-446655440003', 'billing', '789 Pine Rd', 'Chicago', 'IL', '60601', 'USA', '60601', '+1-555-0103')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions (if needed - typically handled by Docker setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO order_service_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO order_service_user;

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'Order Service database initialized successfully!';
    RAISE NOTICE 'Tables created: orders, order_items, addresses';
    RAISE NOTICE 'Sample data inserted for testing';
END $$; 