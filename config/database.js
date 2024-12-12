const { Sequelize } = require('sequelize');

// Load environment variables
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'inspira_home',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'tazamaza03',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // Disable SQL query logging (set to true if needed for debugging)
  }
);

module.exports = sequelize;
