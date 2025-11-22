import express from 'express'
import rateLimit from "express-rate-limit";
import cookieParser from 'cookie-parser'
import cors from 'cors'
import requestIp from "request-ip";

import { connectdb } from './db/connectdb.js'
import {app, server} from './utils/socket.js'
import { job } from './utils/cron.js';

import authRoutes from './routes/authRoute.js'
import adminRoutes from './routes/adminRoute.js'
import appealRoutes from './routes/appealRoute.js'
import chatRoutes from './routes/chatRoute.js'
import productRoutes from './routes/productRoute.js'
import requestRoutes from "./routes/requestRoute.js";
import reviewRoutes from "./routes/reviewRoute.js";
import orderRoutes from './routes/orderRoute.js'
import paymentRoutes from './routes/paymentRoute.js'
import reportRoutes from './routes/reportRoute.js'
import withdrawalRoutes from './routes/withdrawalRoute.js'
import settingsRoutes from './routes/settingsRoute.js'
import notificationRoutes from './routes/notificationRoute.js'
import webhookRoute from './routes/webhookRoute.js'

const PORT = process.env.PORT || 5000

// ✅ Enable trust proxy (needed on Render, Vercel, etc.)
app.set("trust proxy", 1);

// ✅ Use request-ip middleware
app.use(requestIp.mw());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ⏳ 15 minutes
  max: 100, // 🚧 limit each IP to 100 requests per window
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});

app.use(limiter);

const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
  ];
  
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

app.use(express.json({limit: '10mb'}))
app.use(cookieParser())

if(process.env.NODE_ENV === 'PRODUCTION') job.start();

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true });
});

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/appeals', appealRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/products', productRoutes)
app.use("/api/requests", requestRoutes);
app.use("/api/reviews", reviewRoutes);
app.use('/api/orders', orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/withdrawals', withdrawalRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/webhook', webhookRoute)

server.listen(PORT, ()=> {
    connectdb()
    console.log(`server is running on port ${PORT}`)
})