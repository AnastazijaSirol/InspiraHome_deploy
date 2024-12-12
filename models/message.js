const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Group = require('./group');

const Message = sequelize.define('Message', {
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

Message.belongsTo(User, { foreignKey: 'userId' });
Message.belongsTo(Group, { foreignKey: 'groupId' });

module.exports = Message;
