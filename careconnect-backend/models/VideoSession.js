const mongoose = require('mongoose');

// Backing store for consultation video sessions. Provider credentials/tokens
// are never exposed to the frontend directly (see services/videoService.js);
// only short-lived room tokens are returned from the controller.
const videoSessionSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    roomName: { type: String, required: true, unique: true },
    status: { type: String, enum: ['CREATED', 'ACTIVE', 'ENDED'], default: 'CREATED' },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VideoSession', videoSessionSchema);
