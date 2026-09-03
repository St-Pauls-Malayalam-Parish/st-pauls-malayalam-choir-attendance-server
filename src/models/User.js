import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    voicePart: {
      type: String,
      enum: ['soprano', 'alto', 'tenor', 'bass', 'other'],
      default: 'other',
    },
    active: { type: Boolean, default: true },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    username: this.username,
    email: this.email,
    role: this.role,
    voicePart: this.voicePart,
    active: this.active,
    approvalStatus: this.approvalStatus,
  };
};

export const User = mongoose.model('User', userSchema);
