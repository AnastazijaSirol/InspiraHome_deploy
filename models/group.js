const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const Group = sequelize.define('Group', {
  name: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
});

Group.belongsTo(User, { foreignKey: 'userId' });

module.exports = Group;
