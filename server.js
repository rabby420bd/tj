// --- প্যাকেজ ইম্পোর্ট ---
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const cors = require('cors');

// --- সার্ভার ইনিশিয়ালাইজেশন ---
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// --- ১. ফায়ারবেস অ্যাডমিন কনফিগারেশন ---
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
let db; // Firestore instance

if (serviceAccountString) {
  try {
    const serviceAccount = JSON.parse(serviceAccountString);

    if (!admin.apps.length) { // একাধিক ইনিশিয়ালাইজেশন এড়ানোর জন্য
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://trendy-jamakapor.firebaseio.com"
      });
    }

    db = admin.firestore();
    console.log("Firebase Admin SDK initialized successfully.");

  } catch (error) {
    console.error("CRITICAL: Error initializing Firebase Admin SDK. Check JSON format in Environment Variable.", error);
    // Vercel-এ API কল ব্যর্থ হবে যদি key ভুল হয়।
  }
} else {
  console.warn("WARNING: FIREBASE_SERVICE_ACCOUNT is missing. API will fail.");
}

const productsCollection = db ? db.collection('products') : null;
const ordersCollection = db ? db.collection('orders') : null;

// --- সার্ভার মিডলওয়্যার ---
// CORS সেটআপ: ফ্রন্টএন্ড এবং ব্যাকএন্ড যোগাযোগ নিশ্চিত করে
app.use(cors()); 
app.use(bodyParser.json());

// Express Router ব্যবহার করে /api প্রিফিক্স তৈরি করুন
const apiRouter = express.Router();

// --- রিকোয়েস্ট হ্যান্ডলিং ফাংশন ---

// ডেটাবেস প্রস্তুত না হলে ত্রুটি দেখানোর জন্য মিডলওয়্যার
apiRouter.use((req, res, next) => {
  if (!db) {
    // এররটি JSON format এ পাঠানো হচ্ছে, যা ব্রাউজার বুঝতে পারবে
    return res.status(503).json({ 
      error: 'Database service unavailable.', 
      details: 'Firebase Admin SDK failed to initialize. Check FIREBASE_SERVICE_ACCOUNT variable.' 
    });
  }
  next();
});


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


// --- Vercel এর জন্য handler এক্সপোর্ট ---
module.exports = app;

// লোকাল টেস্টিং এর জন্য সার্ভার শুরু করুন (Vercel এই অংশটি উপেক্ষা করবে)
if (!isProduction) {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
