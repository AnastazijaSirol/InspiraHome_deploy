const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require('./user'); 
const Competition = require('./competition');

const Competitor = sequelize.define("Competitor", {
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
})

Competitor.belongsTo(User, { foreignKey: 'userId' });
Competitor.belongsTo(Competition, { foreignKey: 'competitionId' });

module.exports = Competitor;
