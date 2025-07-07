export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: string;
  notes?: string;
  correlationId?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  zipCode: string;
  phone?: string;
}

export interface PaymentMethod {
  type: 'credit_card' | 'paypal' | 'bank_transfer';
  details: Record<string, any>;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export interface CreateOrderRequest {
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: string;
}

export interface UpdateOrderRequest {
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  items?: OrderItem[];
  totalAmount?: number;
  currency?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  paymentMethod?: string;
}

export interface OrderFilters {
  userId?: string;
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface OrderMetrics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByDate: Array<{
    date: string;
    count: number;
    revenue: number;
  }>;
}

// Business Events
export interface OrderCreatedEvent {
  type: 'order.created';
  orderId: string;
  userId: string;
  totalAmount: number;
  status: OrderStatus;
  timestamp: Date;
  correlationId: string;
}

export interface OrderStatusChangedEvent {
  type: 'order.status_changed';
  orderId: string;
  userId: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  timestamp: Date;
  correlationId: string;
}

export interface OrderCancelledEvent {
  type: 'order.cancelled';
  orderId: string;
  userId: string;
  reason: string;
  timestamp: Date;
  correlationId: string;
}

export type OrderEvent = OrderCreatedEvent | OrderStatusChangedEvent | OrderCancelledEvent; 