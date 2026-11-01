const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const env = require('./config/env');
const { globalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const aiRoutes = require('./routes/aiRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const videoRoutes = require('./routes/videoRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const admissionRoutes = require('./routes/admissionRoutes');
const bedRoutes = require('./routes/bedRoutes');
const roomRoutes = require('./routes/roomRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const adminRoutes = require('./routes/adminRoutes');
const continuityRoutes = require('./routes/continuityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const medicineScheduleRoutes = require('./routes/medicineScheduleRoutes');
const userPreferenceRoutes = require('./routes/userPreferenceRoutes');
const deviceTokenRoutes = require('./routes/deviceTokenRoutes');

const app = express();

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize()); // strips $/. operators from user input to prevent NoSQL injection
app.use(globalLimiter);

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
}

// Static serving for locally-stored uploads. Files are served by opaque,
// randomly-generated filenames (see middleware/upload.js) — directory
// listing is disabled by express.static's defaults, and access-controlled
// files (e.g. medical documents that should not be public) should instead
// be served via an authenticated download route in a production build.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'CareConnect AI Backend', timestamp: new Date().toISOString() }));

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/conversations', chatRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/medicines', pharmacyRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/continuity', continuityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/schedules', medicineScheduleRoutes);
app.use('/api/preferences', userPreferenceRoutes);
app.use('/api/devices', deviceTokenRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
