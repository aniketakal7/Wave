const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver ID is required'],
      index: true,
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt alongside the custom timestamp
  }
);

// Compound index to efficiently fetch conversations between two users
messageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

// Static method: fetch full conversation between two users
messageSchema.statics.getConversation = function (userId1, userId2, limit = 50) {
  return this.find({
    $or: [
      { senderId: userId1, receiverId: userId2 },
      { senderId: userId2, receiverId: userId1 },
    ],
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('senderId', 'username email')
    .populate('receiverId', 'username email');
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;