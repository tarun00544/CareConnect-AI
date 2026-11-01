require('dotenv').config();

const required = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key] && process.env.NODE_ENV !== 'test') {
    console.warn(`[config] Warning: environment variable ${key} is not set.`);
  }
}

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
   ai: {
  apiKey: process.env.AI_API_KEY,
  apiUrl: process.env.AI_API_URL,
  model: process.env.AI_MODEL || 'gemini-2.5-flash',
},
  uploads: {
    maxMb: Number(process.env.MAX_UPLOAD_MB || 10),
  },
  video: {
    apiKey: process.env.VIDEO_PROVIDER_API_KEY,
    apiSecret: process.env.VIDEO_PROVIDER_API_SECRET,
  },
  webrtc: {
    turnUrls: process.env.TURN_URLS ? process.env.TURN_URLS.split(',').map((u) => u.trim()) : [],
    turnUsername: process.env.TURN_USERNAME || '',
    turnCredential: process.env.TURN_CREDENTIAL || '',
  },
};
