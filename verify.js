// netlify/functions/verify.js
// This handles the payment verification after Stripe checkout

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Try using full service account JSON first
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Fall back to individual fields
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err);
  }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { sessionId, userId } = JSON.parse(event.body);

    console.log('🔍 Verifying payment:', { sessionId, userId });

    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing sessionId' }),
      };
    }

    // Retrieve the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Session not found' }),
      };
    }

    console.log('📋 Session status:', session.payment_status);

    // Check if payment was successful
    if (session.payment_status === 'paid') {
      const customerEmail = session.customer_details?.email || session.customer_email;
      
      console.log('💳 Payment confirmed for:', customerEmail);

      // Update user in Firestore by email (since we might not have userId)
      if (customerEmail) {
        const usersRef = db.collection('Users');
        const snapshot = await usersRef.where('Email', '==', customerEmail).get();

        if (!snapshot.empty) {
          const updatePromises = [];
          snapshot.forEach((doc) => {
            console.log('📝 Updating user:', doc.id);
            updatePromises.push(
              doc.ref.update({
                isPaid: true,
                subscriptionStatus: 'active',
                stripeCustomerId: session.customer,
                stripeSubscriptionId: session.subscription,
                stripeSessionId: sessionId,
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
              })
            );
          });
          await Promise.all(updatePromises);
          console.log('✅ User account activated');
        } else {
          console.warn('⚠️ No user found with email:', customerEmail);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Payment verified and account activated',
          customerEmail,
        }),
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Payment not completed',
          status: session.payment_status,
        }),
      };
    }
  } catch (error) {
    console.error('🔥 Verification error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};