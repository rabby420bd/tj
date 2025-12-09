import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ShoppingBag,
  Menu,
  X,
  Search,
  Send,
  Phone,
  Mail,
  Facebook,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import {
  subscribeToProducts,
  subscribeToOrders,
  subscribeToChats,
  sendMessage,
  addOrder,
  updateOrderStatus,
  initAuth,
  signOut,
  uploadImage,
} from "./services/firebaseService";

import { ProductCard } from "./components/ProductCard";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { CartView } from "./components/CartView";
import { CheckoutView } from "./components/CheckoutView";
import { AdminView } from "./components/AdminView";

import { Product, CartItem, Order, ChatMessage } from "./types";

/* -----------------------------
   GLOBAL APP WRAPPER COMPONENT
------------------------------ */

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [view, setView] = useState<
    "home" | "product" | "cart" | "checkout" | "track" | "admin"
  >("home");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [qty, setQty] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  const [trackOpen, setTrackOpen] = useState(false);
  const [trackingValue, setTrackingValue] = useState("");

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatName, setChatName] = useState(
    localStorage.getItem("trendy_chat_name") || ""
  );
  const [chatMessage, setChatMessage] = useState("");

  const [user, setUser] = useState<any>(null);

  /* -----------------------------
        FIREBASE SUBSCRIPTIONS
  ------------------------------ */

  useEffect(() => {
    initAuth((u) => setUser(u));

    const unsubProducts = subscribeToProducts(setProducts);
    const unsubOrders = subscribeToOrders(setOrders);
    const unsubChats = subscribeToChats(setChats);

    return () => {
      unsubProducts();
      unsubOrders();
      unsubChats();
    };
  }, []);

  /* -----------------------------
        ADD TO CART
  ------------------------------ */

  const addToCartHandler = (product: Product) => {
    const existing = cart.find((c) => c.id === product.id);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.id === product.id ? { ...c, quantity: c.quantity + qty } : c
        )
      );
    } else {
      setCart([...cart, { id: product.id, quantity: qty }]);
    }
    setQty(1);

    setNotification({ type: "success", message: "Added to cart!" });

    setTimeout(() => setNotification(null), 1500);
  };

  /* -----------------------------
       TRACK ORDER FUNCTION
  ------------------------------ */

  const trackOrder = (trackingId: string) => {
    if (!trackingId) return;

    const found = orders.find((o) => o.trackingId === trackingId);

    if (found) {
      alert(`Order Found!\nStatus: ${found.status}`);
    } else {
      alert("Order not found");
    }
  };
    /* -----------------------------
        SEARCH BAR (PATCHED)
  ------------------------------ */

  const SearchBar = () => {
    return (
      <div className="px-4 max-w-xl mx-auto -mt-10 relative z-30">
        <div className="relative group shadow-xl rounded-full bg-white">
          <input
            id="product-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-12 pr-4 py-4 rounded-full border-none outline-none focus:ring-2 focus:ring-primary"
            autoComplete="off"
            onTouchStart={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
          />

          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Search className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  };

  /* -----------------------------
        TRACK ORDER VIEW (PATCHED)
  ------------------------------ */

  const TrackOrderView = () => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (trackOpen) {
        const t = window.setTimeout(() => {
          try {
            inputRef.current?.focus();
          } catch (e) {}
        }, 80);

        return () => clearTimeout(t);
      }
    }, [trackOpen]);

    const stopTouch = (e: any) => {
      if (e && e.stopPropagation) e.stopPropagation();
    };

    if (!trackOpen) return null;

    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center pointer-events-none">
        <div
          className="pointer-events-auto mb-8 w-[360px] max-w-[96vw] bg-white rounded-xl shadow-lg p-4 transform-none"
          onTouchStart={stopTouch}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Track Order</h4>
            <button
              type="button"
              onClick={() => setTrackOpen(false)}
              className="text-gray-600"
            >
              Close
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              trackOrder(trackingValue.trim());
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={trackingValue}
              onChange={(e) => setTrackingValue(e.target.value)}
              placeholder="Enter tracking ID"
              className="flex-1 px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-primary"
              autoComplete="off"
              onTouchStart={(e) => e.stopPropagation()}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded bg-primary text-white"
            >
              Track
            </button>
          </form>
        </div>
      </div>
    );
  };

  /* -----------------------------
        CHAT WIDGET (PATCHED)
  ------------------------------ */

  const ChatWidget = () => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (chatOpen) {
        const t = window.setTimeout(() => {
          try {
            inputRef.current?.focus();
          } catch (e) {}
        }, 80);
        return () => clearTimeout(t);
      }
    }, [chatOpen]);

    const stopTouch = (e: any) => {
      if (e && e.stopPropagation) e.stopPropagation();
    };

    return (
      <div
        className="fixed bottom-4 right-4 z-[70] flex flex-col gap-4 items-end transform-none"
        onTouchStart={stopTouch}
        onClick={(e) => e.stopPropagation()}
      >
        {/* WhatsApp Shortcut */}
        <a
          href="https://wa.me/8801401603157?text=I%20want%20to%20buy%20a%20product"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#25D366] p-3 rounded-full shadow-lg w-14 h-14 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
            alt="WhatsApp"
            className="w-8 h-8 object-contain"
          />
        </a>

        {/* Chat Panel */}
        {chatOpen && (
          <div className="w-[320px] max-w-[92vw] bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
            <header className="flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold">Live Support</h3>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="p-2 text-gray-600"
              >
                Close
              </button>
            </header>

            <div className="p-3 flex-1 overflow-auto">
              {chats
                .filter((c) => c.customerId === (user?.uid || "guest"))
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-2 ${
                      msg.sender === "customer" ? "text-right" : ""
                    }`}
                  >
                    <div
                      className={`inline-block px-3 py-2 rounded-lg ${
                        msg.sender === "customer"
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = chatMessage.trim();
                if (!text) return;

                sendMessage({
                  customerId: user?.uid || "guest",
                  sender: "customer",
                  text,
                  read: false,
                });

                setChatMessage("");
                setTimeout(() => {
                  try {
                    inputRef.current?.focus();
                  } catch (e) {}
                }, 40);
              }}
              className="p-3 border-t flex gap-2"
            >
              <input
                ref={inputRef}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                autoComplete="off"
                onTouchStart={(e) => e.stopPropagation()}
              />

              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-primary text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Toggle button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setChatOpen(!chatOpen);
          }}
          className="bg-primary p-3 rounded-full text-white shadow-lg"
          aria-pressed={chatOpen}
        >
          {chatOpen ? "−" : "+"}
        </button>
      </div>
    );
  };
    /* -----------------------------
        MAIN APP UI
  ------------------------------ */

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* Navbar */}
      <Navbar
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        onNavigate={(page) => {
          setView(page as any);
          setChatOpen(false);
        }}
      />

      {/* Search Bar */}
      {view === "home" && <SearchBar />}

      {/* Main Content */}
      <main className="flex-1">
        {view === "home" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
            {products
              .filter((p) =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onClick={() => {
                    setSelectedProductId(p.id);
                    setView("product");
                  }}
                />
              ))}
          </div>
        )}

        {/* Product Details */}
        {view === "product" && selectedProductId && (
          <div className="p-4">
            {products
              .filter((p) => p.id === selectedProductId)
              .map((product) => (
                <div key={product.id}>

                  <img
                    src={product.images?.[0] || ""}
                    alt={product.name}
                    className="w-full h-64 object-cover rounded-lg mb-4"
                  />

                  <h2 className="text-2xl font-bold mb-2">{product.name}</h2>

                  <p className="text-primary text-xl font-semibold mb-2">
                    Tk {product.price}
                  </p>

                  {product.oldPrice && (
                    <p className="line-through text-gray-500">
                      Tk {product.oldPrice}
                    </p>
                  )}

                  <p className="text-gray-600 my-4">{product.description}</p>

                  <div className="flex items-center gap-4 my-4">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="px-4 py-2 bg-gray-200 rounded"
                    >
                      -
                    </button>

                    <input
                      readOnly
                      value={qty}
                      className="w-12 text-center border rounded"
                    />

                    <button
                      onClick={() => setQty(qty + 1)}
                      className="px-4 py-2 bg-gray-200 rounded"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => addToCartHandler(product)}
                    className="w-full bg-primary text-white py-3 rounded-lg font-bold text-lg"
                  >
                    Add to Cart
                  </button>

                  <button
                    onClick={() => setView("home")}
                    className="mt-4 w-full bg-gray-200 py-3 rounded-lg"
                  >
                    Back
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Cart */}
        {view === "cart" && (
          <CartView cart={cart} setCart={setCart} setView={setView} />
        )}

        {/* Checkout */}
        {view === "checkout" && (
          <CheckoutView
            cart={cart}
            setCart={setCart}
            addOrder={addOrder}
            setView={setView}
            user={user}
          />
        )}

        {/* Track Order Panel */}
        <TrackOrderView />
      </main>
        {/* Notifications / Toast */}
        {notification && (
          <div className="fixed top-6 right-6 z-[80]">
            <div className={`flex items-start gap-3 p-4 rounded shadow-lg ${notification.type === 'success' ? 'bg-white' : 'bg-white'}`}>
              <div className="pt-1">
                {notification.type === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-sm">
                  {notification.type === 'success' ? 'Success' : 'Notice'}
                </h4>
                <p className="text-sm">{notification.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Chat + WhatsApp */}
        <ChatWidget />

        {/* Footer */}
        <Footer />

      {/* end main container */}
      </div>
  );
};

/* -----------------------------
   RENDER APP
------------------------------ */

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(<App />);

export default App;
