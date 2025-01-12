// models/GameHistory.js
const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  players: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    finalDeckSize: Number,
    cardsPlayed: Number,
    drawsUsed: Number
  }],
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rounds: [{
    player1: {
      user: mongoose.Schema.Types.ObjectId,
      card: String
    },
    player2: {
      user: mongoose.Schema.Types.ObjectId,
      card: String
    },
    winner: mongoose.Schema.Types.ObjectId
  }],
  duration: {
    type: Number, // in seconds
    required: true
  },
  specialCards: {
    jokersPlayed: {
      type: Number,
      default: 0
    },
    upgradesPlayed: {
      type: Number,
      default: 0
    }
  },
  totalRounds: {
    type: Number,
    required: true
  },
  wasPrivate: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
gameHistorySchema.index({ 'players.user': 1 });
gameHistorySchema.index({ startTime: -1 });

// Static method to get player stats
gameHistorySchema.statics.getPlayerStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { 'players.user': mongoose.Types.ObjectId(userId) }},
    { $group: {
      _id: null,
      totalGames: { $sum: 1 },
      wins: { 
        $sum: {
          $cond: [{ $eq: ['$winner', mongoose.Types.ObjectId(userId)] }, 1, 0]
        }
      },
      avgDuration: { $avg: '$duration' },
      totalJokersPlayed: { $sum: '$specialCards.jokersPlayed' },
      totalUpgradesPlayed: { $sum: '$specialCards.upgradesPlayed' }
    }}
  ]);

  return stats[0] || {
    totalGames: 0,
    wins: 0,
    avgDuration: 0,
    totalJokersPlayed: 0,
    totalUpgradesPlayed: 0
  };
};

// Method to summarize game
gameHistorySchema.methods.getGameSummary = function() {
  return {
    winner: this.winner,
    duration: this.duration,
    totalRounds: this.totalRounds,
    specialCards: this.specialCards,
    startTime: this.startTime,
    players: this.players.map(player => ({
      user: player.user,
      finalDeckSize: player.finalDeckSize,
      cardsPlayed: player.cardsPlayed
    }))
  };
};

const GameHistory = mongoose.model('GameHistory', gameHistorySchema);
module.exports = GameHistory;