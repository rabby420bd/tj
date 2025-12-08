import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, doc, query, onSnapshot, runTransaction, serverTimestamp, where, getDocs, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { FIREBASE_CONFIG, APP_ID } from "../constants";
import { Product, Order, ChatMessage } from "../types";

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Collection Helpers
const getPublicCollectionRef = (name: string) => collection(db, 'artifacts', APP_ID, 'public', 'data', name);

// --- Initialization ---
export const initAuth = (callback: (user: any) => void) => {
    return auth.onAuthStateChanged(async (user) => {
        if (user) {
            callback(user);
        } else {
            await signInAnonymously(auth);
        }
    });
};

// --- Products ---
export const subscribeToProducts = (callback: (products: Product[]) => void) => {
    const q = query(getPublicCollectionRef('products'));
    return onSnapshot(q, (snapshot) => {
        const products: Product[] = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() as any } as Product);
        });
        callback(products);
    });
};

export const saveProduct = async (product: Omit<Product, 'id'>, id?: string) => {
    const ref = getPublicCollectionRef('products');
    if (id) {
        await updateDoc(doc(ref, id), { ...product });
    } else {
        await setDoc(doc(ref), product);
    }
};

export const deleteProduct = async (id: string) => {
    await deleteDoc(doc(getPublicCollectionRef('products'), id));
};

// --- Orders ---
export const subscribeToOrders = (callback: (orders: Order[]) => void) => {
    const q = query(getPublicCollectionRef('orders'));
    return onSnapshot(q, (snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() as any } as Order);
        });
        // Sort by timestamp desc
        orders.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        callback(orders);
    });
};

export const createOrder = async (orderData: any, cartItems: any[], products: {[key:string]: Product}) => {
    const ordersRef = getPublicCollectionRef('orders');
    const productsRef = getPublicCollectionRef('products');

    await runTransaction(db, async (transaction) => {
        // Check stock
        for (const item of cartItems) {
            const productDocRef = doc(productsRef, item.id);
            const productDoc = await transaction.get(productDocRef);
            if (!productDoc.exists()) throw new Error(`Product ${item.name} unavailable.`);
            
            const productData = productDoc.data() as Product;
            const currentStock = productData.stock[item.size] || 0;
            
            if (currentStock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.name} (${item.size}).`);
            }

            const newStock = { ...(productData.stock || {}), [item.size]: currentStock - item.quantity };
            transaction.update(productDocRef, { stock: newStock });
        }
        
        const newOrderRef = doc(ordersRef, orderData.orderId);
        transaction.set(newOrderRef, {
            ...orderData,
            timestamp: serverTimestamp()
        });
    });
};

export const updateOrderStatus = async (orderId: string, status: string) => {
    // Note: orderId here refers to the document ID which is the same as the orderId string in createOrder
    const ordersRef = getPublicCollectionRef('orders');
    await updateDoc(doc(ordersRef, orderId), { status });
};

export const deleteOrder = async (orderId: string) => {
    const ordersRef = getPublicCollectionRef('orders');
    await deleteDoc(doc(ordersRef, orderId));
};

export const trackOrders = async (queryStr: string): Promise<Order[]> => {
    const ordersRef = getPublicCollectionRef('orders');
    let q;
    
    // Check if query is Order ID (TJ...) or Phone
    if (queryStr.toUpperCase().startsWith('TJ')) {
        q = query(ordersRef, where('orderId', '==', queryStr.toUpperCase()));
    } else {
        q = query(ordersRef, where('phone', '==', queryStr));
    }

    const snapshot = await getDocs(q);
    const orders: Order[] = [];
    snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() as any } as Order));
    return orders.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
};

// --- Chats ---
export const subscribeToChats = (callback: (chats: ChatMessage[]) => void) => {
    const q = query(getPublicCollectionRef('chats'));
    return onSnapshot(q, (snapshot) => {
        const chats: ChatMessage[] = [];
        snapshot.forEach(doc => {
            chats.push({ id: doc.id, ...doc.data() as any } as ChatMessage);
        });
        chats.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
        callback(chats);
    });
};

export const sendMessage = async (message: Omit<ChatMessage, 'timestamp'>) => {
    const chatsRef = getPublicCollectionRef('chats');
    await setDoc(doc(chatsRef), {
        ...message,
        timestamp: serverTimestamp()
    });
};