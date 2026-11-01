const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, trim: true, default: '' },
    attachment: {
      url: { type: String, default: null },
      type: { type: String, default: null },
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
