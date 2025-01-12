// src/websocket/gameHandlers.js
const gameService = require('../services/gameService');
const jwt = require('jsonwebtoken');

class GameHandlers {
  constructor(io) {
    this.io = io;
    this.activeGames = new Map();
    this.setupAuthMiddleware();
  }

  setupAuthMiddleware() {
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.username = decoded.username;
        next();
      } catch (err) {
        next(new Error('Authentication error'));
      }
    });
  }

  initialize() {
    this.io.on('connection', (socket) => {
      console.log('Player connected:', socket.username);

      // Join game room
      socket.on('joinGame', (gameId) => this.handleJoinGame(socket, gameId));

      // Play card
      socket.on('playCard', (data) => this.handlePlayCard(socket, data));

      // Draw cards
      socket.on('drawCards', (gameId) => this.handleDrawCards(socket, gameId));

      // Handle disconnect
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  async handleJoinGame(socket, gameId) {
    try {
      const game = await gameService.getGame(gameId);
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      socket.join(`game_${gameId}`);
      this.activeGames.set(gameId, {
        ...game.toObject(),
        players: game.players.map(p => ({
          ...p,
          socketId: p.user.toString() === socket.userId ? socket.id : null
        }))
      });

      // Notify all players in the game
      this.io.to(`game_${gameId}`).emit('gameUpdate', this.getGameState(gameId, socket.userId));
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  async handlePlayCard(socket, { gameId, cardIndex }) {
    try {
      const game = await gameService.playCard(gameId, socket.userId, cardIndex);
      const activeGame = this.activeGames.get(gameId);

      if (!activeGame) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Update active game state
      this.activeGames.set(gameId, { ...game.toObject() });

      // Check if both players have played
      const currentRound = game.rounds[game.rounds.length - 1];
      if (currentRound.player1Card && currentRound.player2Card) {
        // Determine round winner
        const winner = gameService.determineRoundWinner(currentRound);
        this.io.to(`game_${gameId}`).emit('roundComplete', {
          round: currentRound,
          winner
        });

        // Check for game end
        if (this.isGameOver(game)) {
          const gameWinner = this.determineGameWinner(game);
          await gameService.endGame(gameId, gameWinner);
          this.io.to(`game_${gameId}`).emit('gameOver', { winner: gameWinner });
        }
      }

      // Send updated game state to all players
      this.io.to(`game_${gameId}`).emit('gameUpdate', this.getGameState(gameId, socket.userId));
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  async handleDrawCards(socket, gameId) {
    try {
      const game = await gameService.drawCards(gameId, socket.userId);
      this.activeGames.set(gameId, { ...game.toObject() });

      // Notify all players of the draw
      this.io.to(`game_${gameId}`).emit('cardDrawn', {
        playerId: socket.userId,
        remainingDraws: game.players.find(p => p.user.toString() === socket.userId).drawsRemaining
      });

      // Send updated game state
      this.io.to(`game_${gameId}`).emit('gameUpdate', this.getGameState(gameId, socket.userId));
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  handleDisconnect(socket) {
    console.log('Player disconnected:', socket.username);
    // Handle any cleanup needed
  }

  // Helper methods
  getGameState(gameId, userId) {
    const game = this.activeGames.get(gameId);
    if (!game) return null;

    // Return different state based on player perspective
    return {
      id: game._id,
      currentTurn: game.currentTurn,
      players: game.players.map(player => ({
        id: player.user,
        username: player.username,
        cardsCount: player.deck.length,
        drawsRemaining: player.drawsRemaining,
        // Only send full deck info to the owner
        deck: player.user.toString() === userId ? player.deck : null
      })),
      rounds: game.rounds,
      status: game.status
    };
  }

  isGameOver(game) {
    // Add your game over conditions
    return game.players.some(player => player.deck.length === 0);
  }

  determineGameWinner(game) {
    // Add your winner determination logic
    const player1Cards = game.players[0].deck.length;
    const player2Cards = game.players[1].deck.length;
    return player1Cards > player2Cards ? game.players[0].user : game.players[1].user;
  }
}

module.exports = GameHandlers;