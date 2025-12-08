
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import { 
    initAuth, 
    subscribeToProducts, 
    subscribeToOrders, 
    subscribeToChats, 
    createOrder, 
    saveProduct, 
    deleteProduct, 
    updateOrderStatus, 
    deleteOrder, 
    trackOrders, 
    sendMessage,
    auth
} from './services/firebaseService';
import { Product, CartItem, Order, Category, CATEGORIES, ChatMessage } from './types';
import { ADMIN_EMAIL, DELIVERY_CHARGE, ORDER_STATUSES, BKASH_LOGO_URL } from './constants';
import { 
    Search, Plus, Minus, Trash2, Edit2, LogOut, Send, 
    Package, CheckCircle, Clock, Truck, MapPin, 
    MessageCircle, ChevronRight, AlertCircle, Phone, Mail, Facebook, X, ShoppingCart
} from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

const App = () => {
    // --- State ---
    const [view, setView] = useState('home');
    const [user, setUser] = useState<any>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [chats, setChats] = useState<ChatMessage[]>([]);
    const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
    
    // Notifications
    const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    
    // Navigation State
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Tracking State
    const [trackQuery, setTrackQuery] = useState('');
    const [trackResults, setTrackResults] = useState<Order[] | null>(null);
    const [trackLoading, setTrackLoading] = useState(false);

    // Admin State
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [adminActiveTab, setAdminActiveTab] = useState<'products'|'orders'|'chat'>('products');
    const [adminChatCustomer, setAdminChatCustomer] = useState<string | null>(null);
    // New State for Admin Images
    const [adminProductImages, setAdminProductImages] = useState<string[]>(['']);

    // Chat Widget State
    const [chatOpen, setChatOpen] = useState(false);
    const [chatName, setChatName] = useState(localStorage.getItem('trendy_chat_name') || '');
    const [chatMessage, setChatMessage] = useState('');

    // --- Effects ---
    useEffect(() => {
        initAuth((u) => setUser(u));
        const unsubProducts = subscribeToProducts(setProducts);
        const unsubOrders = subscribeToOrders(setOrders);
        const unsubChats = subscribeToChats(setChats);
        
        // Load cart
        const savedCart = localStorage.getItem('trendy_cart');
        if (savedCart) setCart(JSON.parse(savedCart));

        return () => {
            unsubProducts();
            unsubOrders();
            unsubChats();
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('trendy_cart', JSON.stringify(cart));
    }, [cart]);

    // Update Admin Images when editing product changes
    useEffect(() => {
        if (editingProduct) {
            setAdminProductImages(editingProduct.images && editingProduct.images.length > 0 ? editingProduct.images : ['']);
        } else {
            setAdminProductImages(['']);
        }
    }, [editingProduct]);

    // --- Derived State ---
    const cartCount = Object.values(cart).reduce((acc, item) => acc + item.quantity, 0);
    const cartTotal = Object.values(cart).reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const isAdmin = user?.email === ADMIN_EMAIL;

    // --- Handlers ---
    
    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const addToCart = (product: Product, size: string, quantity: number) => {
        const key = `${product.id}_${size}`;
        setCart(prev => ({
            ...prev,
            [key]: {
                id: product.id,
                name: product.name,
                price: product.price,
                size,
                quantity: (prev[key]?.quantity || 0) + quantity,
                image: product.images[0]
            }
        }));
        showNotification(`Added ${quantity} x ${product.name} to cart`);
    };

    const removeFromCart = (key: string) => {
        const newCart = { ...cart };
        delete newCart[key];
        setCart(newCart);
    };

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!trackQuery.trim()) return;
        
        setTrackLoading(true);
        setTrackResults(null); // Reset previous results
        try {
            const results = await trackOrders(trackQuery);
            setTrackResults(results);
            if (results.length === 0) {
                showNotification('No orders found with that details', 'error');
            }
        } catch (error) {
            console.error(error);
            showNotification('Error tracking order', 'error');
        }
        setTrackLoading(false);
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            if (auth.currentUser?.email !== ADMIN_EMAIL) {
                await signOut(auth);
                alert('Not an admin account');
            } else {
                setView('admin');
            }
        } catch (error) {
            alert('Login failed');
        }
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        const stockStr = formData.get('stockData') as string;
        const stock: {[key:string]:number} = {};
        stockStr.split('|').forEach(s => {
            const [size, qty] = s.split(':');
            if (size && qty) stock[size] = parseInt(qty);
        });

        const productData = {
            name: formData.get('name') as string,
            slug: formData.get('slug') as string,
            description: formData.get('description') as string,
            price: Number(formData.get('price')),
            oldPrice: formData.get('oldPrice') ? Number(formData.get('oldPrice')) : undefined,
            // Use state for images instead of form data textarea
            images: adminProductImages.filter(url => url.trim() !== ''),
            stock,
            category: formData.get('category') as Category,
        };

        try {
            await saveProduct(productData, editingProduct?.id);
            setEditingProduct(null);
            setAdminProductImages(['']); // Reset images
            form.reset();
            showNotification('Product saved successfully');
        } catch (error) {
            showNotification('Error saving product', 'error');
        }
    };

    // --- Admin Image Handlers ---
    const handleAddAdminImage = () => setAdminProductImages([...adminProductImages, '']);
    const handleAdminImageChange = (index: number, value: string) => {
        const newImages = [...adminProductImages];
        newImages[index] = value;
        setAdminProductImages(newImages);
    };
    const handleRemoveAdminImage = (index: number) => {
        setAdminProductImages(adminProductImages.filter((_, i) => i !== index));
    };

    // --- Views ---

    const HomeView = () => {
        const featuredProducts = products.slice(0, 8); 

        return (
            <div className="animate-fade-in space-y-16 pb-12">
                {/* Hero */}
                <div className="relative rounded-3xl overflow-hidden bg-gray-900 shadow-2xl group mx-4 mt-6">
                    <div className="absolute inset-0 opacity-60">
                        <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop" alt="Fashion Banner" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                    </div>
                    <div className="relative z-10 px-8 py-20 md:py-32 flex flex-col items-center text-center">
                        <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 tracking-tight">Elevate Your Style</h1>
                        <p className="text-gray-200 text-lg md:text-xl mb-8 max-w-xl">Discover the latest trends. Premium quality, curated for you.</p>
                        <button onClick={() => {
                            const el = document.getElementById('shop-section');
                            el?.scrollIntoView({ behavior: 'smooth' });
                        }} className="bg-white text-gray-900 px-8 py-3 rounded-full font-bold hover:bg-primary hover:text-white transition-colors shadow-lg transform hover:-translate-y-1">
                            Shop Collection
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="px-4 max-w-xl mx-auto -mt-10 relative z-30">
                    <div className="relative group shadow-xl rounded-full bg-white">
                        <input 
                            id="product-search"
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products..."
                            className="w-full pl-12 pr-4 py-4 rounded-full border-none focus:ring-2 focus:ring-primary outline-none transition text-gray-800"
                        />
                        <Search className="absolute left-4 top-4 h-6 w-6 text-gray-400 group-hover:text-primary transition-colors" />
                    </div>
                </div>

                {/* Category Pills & Shop Section */}
                <div className="px-4 max-w-7xl mx-auto" id="shop-section">
                    {!searchQuery && (
                        <div className="flex flex-wrap justify-center gap-3 mb-10">
                            <button 
                                onClick={() => setSelectedCategory('All')}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${selectedCategory === 'All' ? 'bg-primary text-white shadow-lg scale-105' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                            >
                                All
                            </button>
                            {CATEGORIES.map(cat => (
                                <button 
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${selectedCategory === cat ? 'bg-primary text-white shadow-lg scale-105' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Filtered Content */}
                    {searchQuery ? (
                         <div className="animate-fade-in">
                            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">Search Results</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {products.filter(p => 
                                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                    p.category.toLowerCase().includes(searchQuery.toLowerCase())
                                ).map(p => (
                                    <ProductCard key={p.id} product={p} onClick={() => { setSelectedProductId(p.id); setView('product'); }} />
                                ))}
                                {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                    <div className="col-span-full text-center py-20 text-gray-500 bg-gray-50 rounded-xl">No products found matching "{searchQuery}"</div>
                                )}
                            </div>
                        </div>
                    ) : selectedCategory === 'All' ? (
                        <div className="space-y-16">
                            {/* New Arrivals Section */}
                            <section>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-serif font-bold text-gray-900">New Arrivals</h2>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {featuredProducts.map(p => (
                                        <ProductCard key={p.id} product={p} onClick={() => { setSelectedProductId(p.id); setView('product'); }} />
                                    ))}
                                </div>
                            </section>

                            {/* Category Sections */}
                            {CATEGORIES.map(cat => {
                                const catProducts = products.filter(p => p.category === cat).slice(0, 4);
                                if (catProducts.length === 0) return null;
                                return (
                                    <section key={cat}>
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-2xl font-serif font-bold text-gray-900">{cat} Collection</h2>
                                            <button 
                                                onClick={() => setSelectedCategory(cat)}
                                                className="text-primary text-sm font-bold hover:underline flex items-center"
                                            >
                                                View All <ChevronRight className="w-4 h-4 ml-1" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                            {catProducts.map(p => (
                                                <ProductCard key={p.id} product={p} onClick={() => { setSelectedProductId(p.id); setView('product'); }} />
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">{selectedCategory} Collection</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {products.filter(p => p.category === selectedCategory).map(p => (
                                    <ProductCard key={p.id} product={p} onClick={() => { setSelectedProductId(p.id); setView('product'); }} />
                                ))}
                                {products.filter(p => p.category === selectedCategory).length === 0 && (
                                    <div className="col-span-full text-center py-20 text-gray-500">No products found in this category.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const ProductDetailView = () => {
        const product = products.find(p => p.id === selectedProductId);
        const [selectedSize, setSelectedSize] = useState('');
        const [qty, setQty] = useState(1);
        const [activeImageIndex, setActiveImageIndex] = useState(0);
        
        if (!product) return <div>Product not found</div>;

        const sizes = Object.entries(product.stock).filter(([_, q]) => q > 0).map(([s]) => s);
        const isDiscounted = product.oldPrice && product.oldPrice > product.price;

        return (
            <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
                <button onClick={() => setView('home')} className="mb-6 text-gray-500 hover:text-primary flex items-center gap-2 text-sm font-medium">
                    ← Back to Shop
                </button>
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden grid md:grid-cols-2 gap-0">
                    <div className="p-6 md:p-8 bg-gray-50 flex flex-col">
                        <div className="aspect-square rounded-xl overflow-hidden bg-white shadow-sm mb-4 relative">
                            <img src={product.images[activeImageIndex] || product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        {/* Thumbnail Gallery */}
                        {product.images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                {product.images.map((img, idx) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => setActiveImageIndex(idx)}
                                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-primary' : 'border-transparent hover:border-gray-300'}`}
                                    >
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-6 md:p-10 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider">{product.category}</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-2 leading-tight">{product.name}</h1>
                        <div className="flex items-center space-x-4 mb-8">
                            <span className="text-3xl font-bold text-primary">৳{product.price.toLocaleString()}</span>
                            {isDiscounted && <span className="text-xl line-through text-gray-400">৳{product.oldPrice?.toLocaleString()}</span>}
                        </div>
                        
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Select Size</label>
                            <div className="flex flex-wrap gap-3">
                                {sizes.length > 0 ? sizes.map(size => (
                                    <button
                                        key={size}
                                        onClick={() => setSelectedSize(size)}
                                        className={`w-12 h-12 flex items-center justify-center border-2 rounded-lg text-sm font-bold transition-all ${selectedSize === size ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                                    >
                                        {size}
                                    </button>
                                )) : <span className="text-red-500 font-bold">Out of Stock</span>}
                            </div>
                        </div>

                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Quantity</label>
                            <div className="flex items-center border border-gray-300 rounded-lg w-32 overflow-hidden">
                                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100">-</button>
                                <input readOnly value={qty} className="w-full h-10 text-center border-0 focus:ring-0 p-0 text-gray-900 font-semibold" />
                                <button onClick={() => setQty(Math.min(10, qty + 1))} className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100">+</button>
                            </div>
                        </div>

                        <div className="mt-auto pt-6 flex gap-4 w-full">
                            <button 
                                onClick={() => {
                                    if(!selectedSize) return showNotification('Please select a size', 'error');
                                    addToCart(product, selectedSize, qty);
                                }}
                                disabled={sizes.length === 0}
                                className="flex-1 py-4 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                <Package className="w-5 h-5" /> Add to Cart
                            </button>
                            <button 
                                onClick={() => {
                                    if(!selectedSize) return showNotification('Please select a size', 'error');
                                    addToCart(product, selectedSize, qty);
                                    setView('checkout');
                                }}
                                disabled={sizes.length === 0}
                                className="flex-1 py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary-dark transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                Buy Now
                            </button>
                        </div>
                        
                        <div className="mt-8 pt-8 border-t border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase mb-2">Description</h3>
                            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-sm">{product.description}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const CheckoutView = () => {
        const [formData, setFormData] = useState({ name: '', phone: '', address: '', trxId: '', location: 'Inside Dhaka' });
        const deliveryCost = DELIVERY_CHARGE[formData.location as keyof typeof DELIVERY_CHARGE];
        const total = cartTotal + deliveryCost;

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (cartCount === 0) return;
            const orderId = `TJ${Date.now().toString().slice(-6)}${formData.phone.slice(-3)}`;
            
            const orderData = {
                orderId,
                customerName: formData.name,
                phone: formData.phone,
                address: formData.address,
                location: formData.location,
                deliveryCharge: deliveryCost,
                transactionId: formData.trxId,
                items: Object.values(cart).map(i => ({ productId: i.id, name: i.name, size: i.size, quantity: i.quantity, price: i.price })),
                subtotal: cartTotal,
                totalAmount: total,
                status: 'Confirmed',
                customer_uid: user?.uid || null
            };

            try {
                await createOrder(orderData, Object.values(cart), products.reduce((acc, p) => ({...acc, [p.id]: p}), {}));
                setCart({});
                showNotification(`Order Placed Successfully! ID: ${orderId}`);
                setView('home');
            } catch (error: any) {
                showNotification('Order Failed: ' + error.message, 'error');
            }
        };

        return (
            <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">Shipping Details</h2>
                        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
                            <input required placeholder="Full Name" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary" onChange={e => setFormData({...formData, name: e.target.value})} />
                            <input required placeholder="Phone Number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary" onChange={e => setFormData({...formData, phone: e.target.value})} />
                            <textarea required placeholder="Full Address" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary" onChange={e => setFormData({...formData, address: e.target.value})} />
                            
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                {Object.entries(DELIVERY_CHARGE).map(([loc, cost]) => (
                                    <label key={loc} className={`p-4 rounded-xl border-2 cursor-pointer transition text-center ${formData.location === loc ? 'border-primary bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input type="radio" name="location" className="sr-only" checked={formData.location === loc} onChange={() => setFormData({...formData, location: loc})} />
                                        <div className="font-bold text-gray-900">{loc}</div>
                                        <div className="text-sm text-gray-500">৳{cost}</div>
                                    </label>
                                ))}
                            </div>
                            
                            <div className="pt-6 border-t border-gray-100">
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                                    <p className="text-sm text-yellow-800 mb-2 font-medium">Send Delivery Charge to Confirm:</p>
                                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-yellow-100">
                                        <span className="font-mono font-bold text-lg text-gray-800">01401603157</span>
                                        <img src={BKASH_LOGO_URL} alt="bKash" className="h-8 object-contain" />
                                    </div>
                                </div>
                                <input required placeholder="Transaction ID (TrxID)" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary font-mono uppercase" onChange={e => setFormData({...formData, trxId: e.target.value})} />
                            </div>
                        </form>
                    </div>
                </div>
                <div className="lg:col-span-5">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
                        <div className="space-y-4 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                            {Object.values(cart).map(item => (
                                <div key={`${item.id}_${item.size}`} className="flex items-center gap-4">
                                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900 text-sm">{item.name}</h4>
                                        <p className="text-xs text-gray-500">{item.size} x {item.quantity}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900">৳{item.price * item.quantity}</p>
                                        <button onClick={() => removeFromCart(`${item.id}_${item.size}`)} className="text-xs text-red-500 hover:underline">Remove</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2 py-4 border-t border-gray-100 text-sm">
                            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>৳{cartTotal}</span></div>
                            <div className="flex justify-between text-gray-600"><span>Delivery</span><span>৳{deliveryCost}</span></div>
                            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2"><span>Total</span><span className="text-primary">৳{total}</span></div>
                        </div>
                        <button form="checkout-form" className="w-full mt-6 py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-primary transition shadow-lg">Confirm Order</button>
                    </div>
                </div>
            </div>
        );
    };

    const TrackOrderView = () => (
        <div className="max-w-3xl mx-auto px-4 py-12 animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center mb-8">
                <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">Track Your Order</h1>
                <p className="text-gray-500 mb-8">Enter your Order ID (e.g. TJ...) or Phone Number</p>
                <form onSubmit={handleTrack} className="relative max-w-md mx-auto">
                    <input value={trackQuery} onChange={e => setTrackQuery(e.target.value)} required placeholder="Order ID or Phone" className="w-full p-4 pr-12 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all" />
                    <button type="submit" disabled={trackLoading} className="absolute right-2 top-2 p-2 bg-gray-900 text-white rounded-lg hover:bg-primary transition shadow-lg disabled:opacity-50">
                        {trackLoading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> : <Search className="w-5 h-5" />}
                    </button>
                </form>
            </div>
            
            <div className="space-y-6">
                {/* Result State */}
                {trackResults && trackResults.map(order => {
                    const statusIdx = ORDER_STATUSES.indexOf(order.status);
                    return (
                        <div key={order.orderId} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-slide-up">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-4 mb-6">
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                        <Package className="w-5 h-5 text-primary" /> Order #{order.orderId}
                                    </h3>
                                    <p className="text-sm text-gray-500">{order.timestamp?.toDate ? new Date(order.timestamp.toDate()).toLocaleString() : 'Just now'}</p>
                                </div>
                                <span className={`mt-2 md:mt-0 px-3 py-1 rounded-full text-xs font-bold uppercase ${order.status === 'Delivered' ? 'bg-green-100 text-green-800' : order.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {order.status}
                                </span>
                            </div>
                            
                            <div className="space-y-6 relative pl-2">
                                {/* Timeline */}
                                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-100"></div>
                                {ORDER_STATUSES.slice(0, 6).map((step, idx) => {
                                    const isCompleted = idx <= statusIdx;
                                    const isCurrent = idx === statusIdx && order.status !== 'Delivered' && order.status !== 'Cancelled';
                                    return (
                                        <div key={step} className="relative flex items-center gap-4">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-colors ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300'}`}>
                                                {isCompleted && <CheckCircle className="w-3 h-3" />}
                                            </div>
                                            <div className={isCompleted ? 'text-gray-900 font-bold' : 'text-gray-400'}>{step}</div>
                                            {isCurrent && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full animate-pulse">Processing</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">Total Amount</p>
                                    <p className="font-bold">৳{order.totalAmount}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Items</p>
                                    <p className="font-bold">{order.items.length} items</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const AdminView = () => {
        if (!isAdmin) return (
            <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-xl">
                <h2 className="text-2xl font-bold mb-6 text-center">Admin Access</h2>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                    <input type="email" placeholder="Email" className="w-full p-3 border rounded-lg" onChange={e => setAdminEmail(e.target.value)} />
                    <input type="password" placeholder="Password" className="w-full p-3 border rounded-lg" onChange={e => setAdminPassword(e.target.value)} />
                    <button type="submit" className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold">Sign In</button>
                </form>
            </div>
        );

        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold font-serif">Dashboard</h1>
                    <button onClick={() => { signOut(auth); setView('home'); }} className="flex items-center gap-2 px-4 py-2 border rounded-full hover:bg-gray-50">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>

                <div className="flex gap-4 mb-8 overflow-x-auto">
                    {['products', 'orders', 'chat'].map(tab => (
                        <button key={tab} onClick={() => setAdminActiveTab(tab as any)} className={`px-6 py-2 rounded-full font-bold capitalize transition ${adminActiveTab === tab ? 'bg-primary text-white' : 'bg-white border text-gray-600'}`}>
                            {tab}
                        </button>
                    ))}
                </div>

                {adminActiveTab === 'products' && (
                    <div className="grid lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-5">
                            <div className="bg-white p-6 rounded-xl shadow-sm border sticky top-24">
                                <h2 className="text-xl font-bold mb-4">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
                                <form onSubmit={handleSaveProduct} className="space-y-3">
                                    <input name="name" defaultValue={editingProduct?.name} required placeholder="Product Name" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-primary" />
                                    <input name="slug" defaultValue={editingProduct?.slug} required placeholder="slug-url" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-primary" />
                                    <div className="flex gap-2">
                                        <input name="price" defaultValue={editingProduct?.price} required type="number" placeholder="Price" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-primary" />
                                        <input name="oldPrice" defaultValue={editingProduct?.oldPrice} type="number" placeholder="Old Price" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <select name="category" defaultValue={editingProduct?.category || 'Other'} className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-primary">
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <textarea name="description" defaultValue={editingProduct?.description} required placeholder="Description" rows={3} className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-primary"></textarea>
                                    
                                    {/* Dynamic Image Inputs */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-gray-500 block">Product Images</label>
                                        {adminProductImages.map((url, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input 
                                                    value={url} 
                                                    onChange={(e) => handleAdminImageChange(index, e.target.value)} 
                                                    placeholder="Image URL" 
                                                    className="flex-1 p-2 border rounded outline-none focus:ring-1 focus:ring-primary text-xs" 
                                                />
                                                <button type="button" onClick={() => handleRemoveAdminImage(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={handleAddAdminImage} className="text-xs text-primary font-bold hover:underline">+ Add Another Image</button>
                                    </div>
                                    
                                    <div className="pt-2">
                                        <label className="text-xs font-bold uppercase text-gray-500">Stock (Format: Size:Qty | Size:Qty)</label>
                                        <input name="stockData" defaultValue={editingProduct ? Object.entries(editingProduct.stock).map(([s, q]) => `${s}:${q}`).join('|') : ''} placeholder="M:5 | L:10 | XL:0" className="w-full p-2 border rounded outline-none focus:ring-1 focus:ring-primary" />
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" className="flex-1 bg-gray-900 text-white py-2 rounded font-bold hover:bg-primary">Save</button>
                                        <button type="button" onClick={() => { setEditingProduct(null); setAdminProductImages(['']); }} className="px-4 border rounded hover:bg-gray-50">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div className="lg:col-span-7 space-y-3 max-h-[800px] overflow-y-auto custom-scrollbar">
                            {products.map(p => (
                                <div key={p.id} className="bg-white p-4 rounded-xl border flex justify-between items-center group hover:shadow-md transition">
                                    <div className="flex items-center gap-4">
                                        <img src={p.images[0]} className="w-12 h-12 rounded bg-gray-100 object-cover" />
                                        <div>
                                            <h4 className="font-bold text-gray-900">{p.name}</h4>
                                            <div className="text-xs text-gray-500 flex gap-2">
                                                <span>৳{p.price}</span>
                                                <span className="bg-gray-100 px-1 rounded">{p.category}</span>
                                                {p.images.length > 1 && <span className="bg-blue-100 text-blue-800 px-1 rounded">{p.images.length} images</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={() => setEditingProduct(p)} className="p-2 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => deleteProduct(p.id)} className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {adminActiveTab === 'orders' && (
                    <div className="space-y-4">
                        {orders.map(order => (
                            <div key={order.id} className="bg-white p-6 rounded-xl border shadow-sm">
                                <div className="flex justify-between mb-4">
                                    <div>
                                        <span className="font-mono font-bold text-lg text-primary">{order.orderId}</span>
                                        <p className="text-xs text-gray-400">{order.timestamp?.toDate ? new Date(order.timestamp.toDate()).toLocaleString() : 'Just now'}</p>
                                    </div>
                                    <select 
                                        value={order.status} 
                                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                        className="bg-gray-50 border rounded-lg px-2 py-1 text-sm font-bold"
                                    >
                                        {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg mb-4">
                                    <div>
                                        <p className="font-bold">{order.customerName}</p>
                                        <p>{order.phone}</p>
                                        <p className="text-gray-500">{order.address}</p>
                                    </div>
                                    <div className="text-right md:text-left">
                                        <p>Total: ৳{order.totalAmount}</p>
                                        <p className="font-mono text-xs text-red-500">TRX: {order.transactionId}</p>
                                        <p className="text-gray-500">{order.location}</p>
                                    </div>
                                </div>
                                <div className="space-y-1 border-t pt-2">
                                    {order.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span>{item.name} ({item.size})</span>
                                            <span className="text-gray-500">x{item.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 text-right">
                                    <button onClick={() => deleteOrder(order.id)} className="text-red-500 text-xs hover:underline">Delete Order</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {adminActiveTab === 'chat' && (
                    <div className="grid grid-cols-12 h-[600px] border rounded-xl overflow-hidden bg-white">
                        <div className="col-span-4 border-r overflow-y-auto">
                            {Array.from(new Set(chats.map(c => c.customerId))).map(custId => {
                                const customerChats = chats.filter(c => c.customerId === custId);
                                const lastMsg = customerChats[customerChats.length - 1];
                                return (
                                    <div key={custId} onClick={() => setAdminChatCustomer(custId)} className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${adminChatCustomer === custId ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}>
                                        <p className="font-bold text-sm truncate">{lastMsg.customerName || 'Guest'}</p>
                                        <p className="text-xs text-gray-500 truncate">{lastMsg.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="col-span-8 flex flex-col">
                            {adminChatCustomer ? (
                                <>
                                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
                                        {chats.filter(c => c.customerId === adminChatCustomer).map(msg => (
                                            <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.sender === 'admin' ? 'bg-primary text-white rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none'}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        sendMessage({ customerId: adminChatCustomer, sender: 'admin', text: (e.target as any).msg.value, read: false });
                                        (e.target as any).reset();
                                    }} className="p-4 border-t bg-white flex gap-2">
                                        <input name="msg" placeholder="Reply..." className="flex-1 p-2 border rounded-lg outline-none focus:ring-1 focus:ring-primary" />
                                        <button className="bg-primary text-white px-4 py-2 rounded-lg font-bold">Send</button>
                                    </form>
                                </>
                            ) : <div className="flex-1 flex items-center justify-center text-gray-400">Select a conversation</div>}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // --- Footer ---
    const Footer = () => (
        <footer className="bg-gray-900 text-white pt-16 pb-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    <div className="space-y-4">
                        <h3 className="font-serif text-2xl font-bold tracking-wider">TRENDY<span className="font-sans text-sm font-light tracking-[0.3em] block text-gray-400 mt-1">JAMAKAPOR</span></h3>
                        <p className="text-gray-400 text-sm leading-relaxed">Redefining men's fashion in Bangladesh with premium quality.</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-lg mb-4">Contact</h4>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li className="flex items-center gap-3"><Phone className="w-5 h-5"/> +880 1401 603157</li>
                            <li className="flex items-center gap-3"><Mail className="w-5 h-5"/> rabby420bd@gmail.com</li>
                            <li className="flex items-center gap-3"><Facebook className="w-5 h-5"/> Trendy Jamakapor</li>
                        </ul>
                    </div>
                    <div>
                         <h4 className="font-bold text-lg mb-4">Info</h4>
                         <p className="text-sm text-gray-400">Designed with ❤ in Bangladesh</p>
                    </div>
                </div>
            </div>
        </footer>
    );

    // --- Chat Widget ---
    const ChatWidget = () => (
        <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-4 items-end">
            {/* WhatsApp Button */}
            <a 
              href="https://wa.me/8801401603157?text=I%20want%20to%20buy%20a%20product" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-[#25D366] p-3 rounded-full shadow-lg hover:scale-110 transition-transform duration-300 flex items-center justify-center w-14 h-14"
              aria-label="Chat on WhatsApp"
            >
                <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                    alt="WhatsApp" 
                    className="w-8 h-8 object-contain"
                />
            </a>

            {/* Custom Chat */}
            <div className="relative">
                {chatOpen && (
                    <div className="absolute bottom-20 right-0 bg-white w-80 h-96 rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-slide-up origin-bottom-right">
                        <div className="bg-primary p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold">Live Support</h3>
                            <button onClick={() => setChatOpen(false)}><X className="w-5 h-5" /></button>
                        </div>
                        {!chatName ? (
                            <div className="flex-1 p-6 flex flex-col justify-center items-center bg-gray-50">
                                <p className="text-gray-600 mb-4 text-sm">Enter your name to start.</p>
                                <input value={chatName} onChange={e => setChatName(e.target.value)} placeholder="Your Name" className="w-full p-2 border rounded mb-2" />
                                <button onClick={() => chatName && localStorage.setItem('trendy_chat_name', chatName)} className="w-full bg-primary text-white py-2 rounded font-bold text-sm">Start</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-2 custom-scrollbar">
                                    {chats.filter(c => c.customerId === (user?.uid || 'guest')).map(msg => (
                                        <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-2 px-3 rounded-xl text-sm ${msg.sender === 'customer' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-800'}`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    if(!chatMessage.trim()) return;
                                    sendMessage({ customerId: user?.uid || 'guest', customerName: chatName, sender: 'customer', text: chatMessage, read: false });
                                    setChatMessage('');
                                }} className="p-3 bg-white border-t flex gap-2">
                                    <input value={chatMessage} onChange={e => setChatMessage(e.target.value)} placeholder="Type..." className="flex-1 p-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary" />
                                    <button type="submit" className="bg-primary text-white p-2 rounded-lg"><Send className="w-4 h-4" /></button>
                                </form>
                            </>
                        )}
                    </div>
                )}
                <button onClick={() => setChatOpen(!chatOpen)} className="bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary-dark transition hover:scale-105 w-14 h-14 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen">
            <Navbar cartCount={cartCount} onNavigate={setView} />
            
            <main className="flex-grow pt-24 pb-12 w-full">
                {view === 'home' && <HomeView />}
                {view === 'product' && <ProductDetailView />}
                {view === 'checkout' && <CheckoutView />}
                {view === 'track' && <TrackOrderView />}
                {view === 'admin' && <AdminView />}
            </main>

            <Footer />
            <ChatWidget />

            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-24 right-4 z-[60] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up ${notification.type === 'success' ? 'bg-white border-l-4 border-green-500 text-gray-800' : 'bg-white border-l-4 border-red-500 text-gray-800'}`}>
                    {notification.type === 'success' ? <CheckCircle className="text-green-500 w-6 h-6" /> : <AlertCircle className="text-red-500 w-6 h-6" />}
                    <div>
                        <h4 className="font-bold text-sm uppercase tracking-wider">{notification.type === 'success' ? 'Success' : 'Error'}</h4>
                        <p className="text-sm font-medium">{notification.message}</p>
                    </div>
                    <button onClick={() => setNotification(null)} className="ml-4 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);

export default App;
