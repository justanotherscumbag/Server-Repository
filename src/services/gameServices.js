// services/gameService.js
const Game = require('../models/Game');
const GameHistory = require('../models/GameHistory');
const User = require('../models/User');

class GameService {
  constructor() {
    this.activeGames = new Map();
  }

  generateInitialDeck() {
    const deck = [
      ...Array(5).fill('Stone'),
      ...Array(5).fill('Sheets'),
      ...Array(5).fill('Sheers'),
      ...Array(2).fill('Boulder'),
      ...Array(2).fill('Cloth'),
      ...Array(2).fill('Sword'),
      'Joker'
    ];
    return this.shuffleDeck(deck);
  }

  shuffleDeck(deck) {
    return deck.sort(() => Math.random() - 0.5);
  }

  async createGame(player1Id, player2Id, isPrivate = false) {
    try {
      const roomCode = isPrivate ? this.generateRoomCode() : null;
      
      const game = new Game({
        players: [
          { user: player1Id, deck: this.generateInitialDeck() },
          { user: player2Id, deck: this.generateInitialDeck() }
        ],
        currentTurn: player1Id,
        status: 'playing',
        roomCode,
        isPrivate
      });

      await game.save();
      this.activeGames.set(game._id.toString(), game);
      return game;
    } catch (error) {
      throw new Error(`Error creating game: ${error.message}`);
    }
  }

  async playCard(gameId, userId, cardIndex) {
    try {
      const game = await Game.findById(gameId);
      if (!game) throw new Error('Game not found');

      const playerIndex = game.players.findIndex(p => p.user.toString() === userId);
      if (playerIndex === -1) throw new Error('Player not found in game');

      const card = game.players[playerIndex].deck[cardIndex];
      if (!card) throw new Error('Card not found');

      // Remove card from player's deck
      game.players[playerIndex].deck.splice(cardIndex, 1);

      // Add to current round
      if (!game.rounds[game.rounds.length - 1] || 
          (game.rounds[game.rounds.length - 1].player1Card && 
           game.rounds[game.rounds.length - 1].player2Card)) {
        game.rounds.push({});
      }

      const currentRound = game.rounds[game.rounds.length - 1];
      if (playerIndex === 0) {
        currentRound.player1Card = card;
      } else {
        currentRound.player2Card = card;
      }

      // Check if round is complete
      if (currentRound.player1Card && currentRound.player2Card) {
        currentRound.winner = this.determineRoundWinner(currentRound);
      }

      await game.save();
      this.activeGames.set(gameId, game);
      return game;
    } catch (error) {
      throw new Error(`Error playing card: ${error.message}`);
    }
  }

  determineRoundWinner(round) {
    const { player1Card, player2Card } = round;
    
    // Handle Joker cases
    if (player1Card === 'Joker' || player2Card === 'Joker') {
      return this.handleJokerCase(player1Card, player2Card);
    }

    // Handle upgrade cards
    if (this.isUpgradeCard(player1Card) || this.isUpgradeCard(player2Card)) {
      return this.handleUpgradeCards(player1Card, player2Card);
    }

    // Handle basic cards
    return this.handleBasicCards(player1Card, player2Card);
  }

  isUpgradeCard(card) {
    return ['Boulder', 'Cloth', 'Sword'].includes(card);
  }

  handleJokerCase(card1, card2) {
    // Joker wins against basic cards, loses against upgrade cards
    if (card1 === 'Joker') {
      return this.isUpgradeCard(card2) ? 'player2' : 'player1';
    }
    if (card2 === 'Joker') {
      return this.isUpgradeCard(card1) ? 'player1' : 'player2';
    }
    return 'draw';
  }

  handleUpgradeCards(card1, card2) {
    const upgradeMap = {
      'Boulder': 'Stone',
      'Cloth': 'Sheets',
      'Sword': 'Sheers'
    };

    if (upgradeMap[card1] === card2) return 'player1';
    if (upgradeMap[card2] === card1) return 'player2';
    return this.handleBasicCards(card1, card2);
  }

  handleBasicCards(card1, card2) {
    const winConditions = {
      'Stone': 'Sheers',
      'Sheers': 'Sheets',
      'Sheets': 'Stone'
    };

    if (winConditions[card1] === card2) return 'player1';
    if (winConditions[card2] === card1) return 'player2';
    return 'draw';
  }

  async drawCards(gameId, userId, count = 2) {
    try {
      const game = await Game.findById(gameId);
      if (!game) throw new Error('Game not found');

      const playerIndex = game.players.findIndex(p => p.user.toString() === userId);
      if (playerIndex === -1) throw new Error('Player not found in game');

      const player = game.players[playerIndex];
      if (player.drawsRemaining <= 0) throw new Error('No draws remaining');

      // Add new cards
      const newCards = this.generateNewCards(count);
      player.deck.push(...newCards);
      player.drawsRemaining--;

      await game.save();
      this.activeGames.set(gameId, game);
      return game;
    } catch (error) {
      throw new Error(`Error drawing cards: ${error.message}`);
    }
  }

  generateNewCards(count) {
    const possibleCards = ['Stone', 'Sheets', 'Sheers', 'Boulder', 'Cloth', 'Sword'];
    return Array(count).fill().map(() => {
      return possibleCards[Math.floor(Math.random() * possibleCards.length)];
    });
  }

  async endGame(gameId, winnerId) {
    try {
      const game = await Game.findById(gameId);
      if (!game) throw new Error('Game not found');

      game.status = 'finished';
      game.winner = winnerId;
      game.endTime = new Date();

      await game.save();

      // Create game history
      const gameHistory = new GameHistory({
        gameId: game._id,
        players: game.players.map(p => ({
          user: p.user,
          finalDeckSize: p.deck.length,
          cardsPlayed: 15 - p.deck.length,
          drawsUsed: 3 - p.drawsRemaining
        })),
        winner: winnerId,
        rounds: game.rounds,
        duration: (game.endTime - game.startTime) / 1000,
        totalRounds: game.rounds.length,
        wasPrivate: game.isPrivate,
        startTime: game.startTime,
        endTime: game.endTime
      });

      await gameHistory.save();

      // Update player stats
      await this.updatePlayerStats(game.players, winnerId);

      this.activeGames.delete(gameId);
      return gameHistory;
    } catch (error) {
      throw new Error(`Error ending game: ${error.message}`);
    }
  }

  async updatePlayerStats(players, winnerId) {
    for (const player of players) {
      const user = await User.findById(player.user);
      if (user) {
        user.stats.gamesPlayed++;
        if (player.user.toString() === winnerId.toString()) {
          user.stats.wins++;
        } else {
          user.stats.losses++;
        }
        await user.save();
      }
    }
  }

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

module.exports = new GameService();