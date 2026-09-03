import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ['practice', 'service', 'concert', 'other'],
      default: 'practice',
    },
    notes: { type: String, trim: true, default: '' },
    liturgicalColor: {
      type: String,
      enum: ['white', 'green', 'purple', 'red', 'black', ''],
      default: '',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

eventSchema.index({ date: -1 });

export const Event = mongoose.model('Event', eventSchema);
