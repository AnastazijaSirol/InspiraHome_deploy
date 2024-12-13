const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('inspira_home', 'postgres', 'tazamaza03', {
  host: 'localhost',
  dialect: 'postgres',
});

module.exports = sequelize;
