
export type Category = 'Winter' | 'Summer' | 'Shirt' | 'T-Shirt' | 'Panjabi' | 'Other';

export const CATEGORIES: Category[] = ['Winter', 'Summer', 'Shirt', 'T-Shirt', 'Panjabi', 'Other'];

export interface Product {
    id: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    oldPrice?: number;
    images: string[];
    stock: { [size: string]: number };
    category: Category;
}

export interface CartItem {
    id: string;
    name: string;
    price: number;
    size: string;
    quantity: number;
    image: string;
}

export type OrderStatus = 'Confirmed' | 'Picked' | 'In Transit' | 'Shipped' | 'Out for delivery' | 'Delivered' | 'Cancelled';

export interface Order {
    id: string; // Document ID
    orderId: string; // TJ... ID
    customerName: string;
    phone: string;
    address: string;
    location: string;
    deliveryCharge: number;
    transactionId: string;
    items: {
        productId: string;
        name: string;
        size: string;
        quantity: number;
        price: number;
    }[];
    subtotal: number;
    totalAmount: number;
    status: OrderStatus;
    timestamp: any; // Firebase Timestamp
    customer_uid: string | null;
}

export interface ChatMessage {
    id?: string;
    customerId: string;
    customerName?: string;
    sender: 'customer' | 'admin';
    text: string;
    timestamp: any;
    read: boolean;
}
