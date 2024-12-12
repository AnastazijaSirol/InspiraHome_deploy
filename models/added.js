const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user'); 

const Added = sequelize.define('Added', {
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

Added.belongsTo(User, { foreignKey: 'userId' });

module.exports = Added;
