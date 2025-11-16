// netlify/functions/send-notification.js
// Sends push notifications to all subscribed users

const admin = require("firebase-admin");

let db;

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log("✅ Firebase admin initialized");
  } catch (err) {
    console.error("❌ Failed to init Firebase admin:", err);
  }
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { title, body: messageBody } = body;

    if (!title || !messageBody) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing title or body" }),
      };
    }

    console.log("📬 Sending notifications:", title);

    // Get all push tokens from Firestore
    const tokensSnapshot = await db.collection("pushTokens").get();
    
    if (tokensSnapshot.empty) {
      console.log("⚠️ No push tokens found");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: "No subscribers to notify" 
        }),
      };
    }

    const tokens = [];
    tokensSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    console.log(`📱 Found ${tokens.length} tokens`);

    if (tokens.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: "No valid tokens to notify" 
        }),
      };
    }

    // Send notifications using Firebase Admin SDK
    const message = {
      notification: {
        title: title,
        body: messageBody,
      },
      data: {
        url: "/alerts.html",
        click_action: "https://arcanearchives.netlify.app/alerts.html"
      },
      webpush: {
        fcmOptions: {
          link: "https://arcanearchives.netlify.app/alerts.html"
        }
      }
    };

    const results = await admin.messaging().sendEachForMulticast({
      tokens: tokens,
      ...message
    });

    console.log(`✅ Sent ${results.successCount} notifications`);
    console.log(`❌ Failed ${results.failureCount} notifications`);

    // Remove invalid tokens
    if (results.failureCount > 0) {
      const invalidTokens = [];
      results.responses.forEach((response, index) => {
        if (!response.success && 
            (response.error.code === 'messaging/invalid-registration-token' ||
             response.error.code === 'messaging/registration-token-not-registered')) {
          invalidTokens.push(tokens[index]);
        }
      });

      // Delete invalid tokens from Firestore
      if (invalidTokens.length > 0) {
        console.log(`🗑️ Removing ${invalidTokens.length} invalid tokens`);
        const deletePromises = [];
        
        for (const token of invalidTokens) {
          const snapshot = await db.collection("pushTokens")
            .where("token", "==", token)
            .get();
          
          snapshot.forEach((doc) => {
            deletePromises.push(doc.ref.delete());
          });
        }
        
        await Promise.all(deletePromises);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        successCount: results.successCount,
        failureCount: results.failureCount,
      }),
    };
  } catch (error) {
    console.error("❌ Error sending notifications:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Error sending notifications",
      }),
    };
  }
};