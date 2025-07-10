-- Product Service Database Initialization
-- This script initializes the product_service_db database

-- Connect to the database (this is automatically done by Docker)
-- \c product_service_db;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    category VARCHAR(100) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data
INSERT INTO products (name, description, price, category, sku, stock_quantity) VALUES
('MacBook Pro 14"', 'Apple MacBook Pro with M3 chip, 14-inch display', 1999.99, 'Electronics', 'MBP-14-M3-001', 15),
('iPhone 15 Pro', 'Latest iPhone with A17 Pro chip and titanium design', 999.99, 'Electronics', 'IPH-15-PRO-001', 25),
('AirPods Pro', 'Wireless earbuds with active noise cancellation', 249.99, 'Electronics', 'APP-001', 50),
('iPad Air', 'Powerful and versatile iPad with M2 chip', 599.99, 'Electronics', 'IPA-M2-001', 20),
('Magic Keyboard', 'Wireless keyboard with numeric keypad', 129.99, 'Accessories', 'MKB-001', 30),
('Magic Mouse', 'Multi-touch wireless mouse', 79.99, 'Accessories', 'MMO-001', 40),
('USB-C Cable', 'High-quality USB-C to USB-C cable', 29.99, 'Accessories', 'USC-001', 100),
('Monitor Stand', 'Adjustable aluminum monitor stand', 199.99, 'Accessories', 'MST-001', 10),
('Wireless Charger', 'Fast wireless charging pad', 49.99, 'Accessories', 'WCH-001', 60),
('Laptop Bag', 'Premium leather laptop bag', 89.99, 'Accessories', 'LBG-001', 25);

-- Create product_categories table for better categorization
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES product_categories(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample categories
INSERT INTO product_categories (name, description) VALUES
('Electronics', 'Electronic devices and gadgets'),
('Accessories', 'Computer and mobile accessories'),
('Software', 'Software licenses and applications'),
('Books', 'Technical books and documentation');

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO product_service_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO product_service_user;

-- Create view for active products
CREATE OR REPLACE VIEW active_products AS
SELECT 
    id,
    name,
    description,
    price,
    category,
    sku,
    stock_quantity,
    created_at,
    updated_at
FROM products 
WHERE is_active = true;

GRANT SELECT ON active_products TO product_service_user;

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'Product Service database initialized successfully!';
    RAISE NOTICE 'Tables created: products, product_categories';
    RAISE NOTICE 'Sample data inserted: % products', (SELECT COUNT(*) FROM products);
    RAISE NOTICE 'Views created: active_products';
END $$; 