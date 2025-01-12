// config/database.js
const mongoose = require('mongoose');

class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
  }

  async connect() {
    try {
      if (this.isConnected) {
        console.log('Using existing database connection');
        return;
      }

      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      await mongoose.connect(process.env.MONGODB_URI, options);

      this.isConnected = true;
      console.log('Database connection established');

      // Handle connection events
      mongoose.connection.on('error', this.handleError.bind(this));
      mongoose.connection.on('disconnected', this.handleDisconnect.bind(this));

    } catch (error) {
      await this.handleConnectionError(error);
    }
  }

  async handleConnectionError(error) {
    console.error('Database connection error:', error);

    if (this.retryAttempts < this.maxRetries) {
      this.retryAttempts++;
      console.log(`Retrying connection... Attempt ${this.retryAttempts}/${this.maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      await this.connect();
    } else {
      console.error('Max retry attempts reached. Database connection failed.');
      process.exit(1);
    }
  }

  handleError(error) {
    console.error('Database error:', error);
    if (!this.isConnected) {
      this.handleConnectionError(error);
    }
  }

  async handleDisconnect() {
    console.log('Database disconnected');
    this.isConnected = false;
    await this.connect();
  }

  async disconnect() {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('Database disconnected successfully');
    }
  }
}

module.exports = new DatabaseManager();