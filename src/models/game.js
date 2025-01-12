// models/Game.js
const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  players: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    deck: [{
      type: String,
      enum: ['Stone', 'Sheets', 'Sheers', 'Boulder', 'Cloth', 'Sword', 'Joker']
    }],
    drawsRemaining: {
      type: Number,
      default: 3
    }
  }],
  currentTurn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rounds: [{
    player1Card: {
      type: String,
      enum: ['Stone', 'Sheets', 'Sheers', 'Boulder', 'Cloth', 'Sword', 'Joker']
    },
    player2Card: {
      type: String,
      enum: ['Stone', 'Sheets', 'Sheers', 'Boulder', 'Cloth', 'Sword', 'Joker']
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  roomCode: {
    type: String,
    unique: true,
    sparse: true // Only enforce uniqueness if field exists
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  }
}, {
  timestamps: true
});

// Method to check if game is over
gameSchema.methods.isGameOver = function() {
  return this.players.some(player => player.deck.length === 0);
};

// Method to get current round
gameSchema.methods.getCurrentRound = function() {
  return this.rounds[this.rounds.length - 1];
};

const Game = mongoose.model('Game', gameSchema);
module.exports = Game;