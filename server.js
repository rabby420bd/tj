// --- প্যাকেজ ইম্পোর্ট ---
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');
const cors = require('cors');

// --- সার্ভার ইনিশিয়ালাইজেশন ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- ১. ফায়ারবেস অ্যাডমিন কনফিগারেশন ---
// Vercel এ deploy করার জন্য FIREBASE_SERVICE_ACCOUNT environment variable থেকে key লোড করা হবে।
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountString) {
  console.error("FATAL ERROR: FIREBASE_SERVICE_ACCOUNT environment variable is not set.");
  // লোকাল টেস্টিং এর জন্য server.js ফাইলটি বন্ধ করে দেওয়া উচিত যদি key না থাকে।
  throw new Error("Firebase Service Account key is missing. Please set FIREBASE_SERVICE_ACCOUNT environment variable.");
}

// এনভায়রনমেন্ট ভেরিয়েবল থেকে JSON ডেটা পার্স করুন
const serviceAccount = JSON.parse(serviceAccountString);

// Firebase Admin SDK ইনিশিয়ালাইজ করুন
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://trendy-jamakapor.firebaseio.com" // আপনার ডেটাবেসের URL
});

const db = admin.firestore();
const productsCollection = db.collection('products');
const ordersCollection = db.collection('orders');

// --- সার্ভার মিডলওয়্যার ---
// Vercel Serverless Functions এর জন্য CORS
app.use(cors({ origin: '*' })); 
app.use(bodyParser.json());

// Express Router ব্যবহার করে /api প্রিফিক্স তৈরি করুন
const apiRouter = express.Router();

// A. প্রোডাক্ট ডেটা পড়ুন (GET /api/products)
apiRouter.get('/products', async (req, res) => {
  try {
    const snapshot = await productsCollection.get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: 'Failed to fetch products from database.' });
  }
});

// B. নতুন প্রোডাক্ট যোগ করুন (POST /api/products)
apiRouter.post('/products', async (req, res) => {
  try {
    const productData = req.body;
    productData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    
    // Firestore এ যোগ করুন
    const docRef = await productsCollection.add(productData);
    res.status(201).json({ id: docRef.id, ...productData });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: 'Failed to add product.' });
  }
});

// C. প্রোডাক্ট আপডেট করুন (PUT /api/products/:id)
apiRouter.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const productData = req.body;
    delete productData.id; 

    const docRef = productsCollection.doc(id);
    await docRef.update(productData);
    res.status(200).json({ message: 'Product updated successfully.' });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// D. প্রোডাক্ট ডিলিট করুন (DELETE /api/products/:id)
apiRouter.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await productsCollection.doc(id).delete();
    res.status(200).json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// E. নতুন অর্ডার তৈরি করুন (POST /api/orders)
apiRouter.post('/orders', async (req, res) => {
  try {
    const orderData = req.body;
    
    // পাবলিক অর্ডার আইডি তৈরি করুন
    const phonePart = orderData.customer.phone.substring(0, 5);
    const uniqueSuffix = Date.now().toString().slice(-3);
    const publicOrderId = `TJ${phonePart}${uniqueSuffix}`;

    const newOrder = {
      ...orderData,
      status: 'Pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      publicOrderId: publicOrderId,
    };
    
    const docRef = await ordersCollection.add(newOrder);
    res.status(201).json({ id: docRef.id, publicOrderId: publicOrderId, ...newOrder });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: 'Failed to place order.' });
  }
});

// F. সব অর্ডার পড়ুন (GET /api/orders) - অ্যাডমিন প্যানেলের জন্য
apiRouter.get('/orders', async (req, res) => {
  try {
    const snapshot = await ordersCollection.orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date() }));
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// G. অর্ডারের স্ট্যাটাস আপডেট করুন (PUT /api/orders/:id)
apiRouter.put('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const docRef = ordersCollection.doc(id);
    await docRef.update({ status: status });
    res.status(200).json({ message: 'Order status updated successfully.' });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// H. অর্ডার ট্র্যাক করুন (GET /api/track?query=...) - ক্লায়েন্টের জন্য
apiRouter.get('/track', async (req, res) => {
  try {
    const queryValue = req.query.query;
    if (!queryValue) {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    let q;
    // ফোন নম্বর বা পাবলিক অর্ডার আইডি দ্বারা খুঁজুন
    if (queryValue.toUpperCase().startsWith('TJ')) {
      q = ordersCollection.where('publicOrderId', '==', queryValue.toUpperCase());
    } else {
      q = ordersCollection.where('customer.phone', '==', queryValue);
    }

    const snapshot = await q.orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date() }));

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error tracking order:", error);
    res.status(500).json({ error: 'Failed to track order. Check server console for details.' });
  }
});


// /api রুটের জন্য Express Router কে ব্যবহার করুন
app.use('/api', apiRouter);

// --- Vercel Fix: index.html কে রুট রিকোয়েস্টের জন্য ব্যবহার করা ---
// Vercel যখন রুট রিকোয়েস্ট (`/`) পায়, তখন index.html ফাইলটি পাঠায়।
// কিন্তু যদি API-তে কোনো ত্রুটি হয়, index.html-কে সার্ভ করা ঠিক নয়।
// Vercel এ এটি স্বয়ংক্রিয়ভাবে হয়ে যায়, তাই এই অংশ local testing ছাড়া দরকার নেই।
/*
app.use(express.static(path.join(__dirname, '')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
*/

// লোকাল টেস্টিং এর জন্য সার্ভার শুরু করুন
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Open http://localhost:${PORT}/index.html in your browser.`);
    });
}

// Vercel এর জন্য handler এক্সপোর্ট
module.exports = app;
