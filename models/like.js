const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const Like = sequelize.define('Like', {

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  likedAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW,
  },
});

Like.belongsTo(User, { foreignKey: 'userId' })

module.exports = Like;
