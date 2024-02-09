var utility = require('a.utilities');
var roleHarvester = {
    run: function(creep) {
        const haulers = _.filter(Game.creeps, (c) => c.memory.role === 'hauler').length;

        if (!creep.memory.sourceId || creep.store.getFreeCapacity() === 0) {
            delete creep.memory.sourceId; // Clear the source ID to re-evaluate next cycle when empty
        }

        // Decision-making process for harvesting or energy management
        if (creep.store.getFreeCapacity() > 0) {
            this.harvestEnergy(creep);
        } else {
            this.manageEnergy(creep, haulers);
        }
    },


    manageEnergy: function(creep, haulers) {
        if (haulers < 1) {
            // Transfer energy directly to the spawn or other structures
            this.transferEnergy(creep);
        } else {
            // Move towards spawn for 10 ticks then drop energy
            this.dropEnergyNearSpawn(creep);
        }
    },

    transferEnergy: function(creep) {
        var target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_SPAWN || 
                        structure.structureType == STRUCTURE_EXTENSION || 
                        structure.structureType == STRUCTURE_TOWER) && 
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        if (target && creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            //utility.moveToWithCCM(creep, target);
            creep.say('📥');
        }
    },

    dropEnergyNearSpawn: function(creep) {
        if (!creep.memory.moveTicks) {
            creep.memory.moveTicks = 0;
        }

        if (creep.memory.moveTicks < 3) {
            var spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            creep.moveTo(spawn);
            //utility.moveToWithCCM(creep, spawn);
            creep.say('🧭');
            creep.memory.moveTicks++;
        } else {
            creep.drop(RESOURCE_ENERGY);
            creep.say('⏬');
            // Reset for next cycle
            creep.memory.moveTicks = 0;
        }
    },
    
    harvestEnergy: function(creep) {
        utility.harvestEnergy(creep);
    },
    chooseSource: function(creep) {
        utility.chooseSource(creep);
    },
};

module.exports = roleHarvester;
