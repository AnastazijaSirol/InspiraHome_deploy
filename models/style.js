const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user'); 

const Style = sequelize.define('Style', {
  style: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

Style.belongsTo(User, { foreignKey: 'userId' });

module.exports = Style;
