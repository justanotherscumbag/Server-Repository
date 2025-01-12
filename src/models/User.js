// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: function() {
      return !this.isGuest; // Password only required for non-guest users
    }
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    winRate: { 
      type: Number, 
      default: 0,
      get: function() {
        if (this.stats.gamesPlayed === 0) return 0;
        return (this.stats.wins / this.stats.gamesPlayed) * 100;
      }
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && !this.isGuest) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to validate password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (this.isGuest) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
