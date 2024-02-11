var utility = require('a.utilities');
var roleHarvester = {
    run: function(creep) {
        const haulers = _.filter(Game.creeps, (c) => c.memory.role === 'hauler').length;

        if (!creep.memory.sourceId || creep.store.getFreeCapacity() === 0) {
            delete creep.memory.sourceId; // Clear the source ID to re-evaluate next cycle when empty
        }

        // Decision-making process for harvesting or energy management
        if (creep.store.getFreeCapacity() > 0) {
            utility.harvestEnergy(creep); // Call the utility's method directly
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
            this.passEnergy(creep);
        }
    },

    transferEnergy: function(creep) {
        var target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN || 
                        structure.structureType === STRUCTURE_EXTENSION || 
                        structure.structureType === STRUCTURE_TOWER ||
                        structure.structureType === STRUCTURE_CONTAINER) && 
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        if (target && creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            utility.moveToTarget(creep, target, 1); // Use moveToTarget for optimized pathfinding
            creep.say('📥');
        }
    },

    passEnergy: function(creep) {
        // First, check if there are containers within 20 tiles of the creep.
        var containers = creep.pos.findInRange(FIND_STRUCTURES, 20, {
            filter: { structureType: STRUCTURE_CONTAINER }
        });
    
        // If there are containers available, try to deposit energy in the nearest one.
        if (containers.length > 0) {
            // Find the closest container.
            var closestContainer = creep.pos.findClosestByPath(containers);
    
            if (creep.transfer(closestContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                // Move towards the container if not in range to transfer energy.
                utility.moveToTarget(creep, closestContainer, 1);
                creep.say('📦');
            }
        } else {
            // If no containers are found within range or cannot deposit for some reason, fallback to dropping energy.
            // This section might be reached if, for example, all containers are full or too far away.
            if (!creep.memory.moveTicks) {
                creep.memory.moveTicks = 0;
            }
    
            if (creep.memory.moveTicks < 5) { // Keeping your original logic for moving towards the spawn before dropping.
                var spawn = creep.room.find(FIND_MY_SPAWNS)[0];
                if (spawn) {
                    utility.moveToTarget(creep, spawn, 1); // Move towards the spawn
                    creep.say('🧭');
                    creep.memory.moveTicks++;
                }
            } else {
                // Drop energy if not near a container or unable to transfer to it.
                creep.drop(RESOURCE_ENERGY);
                creep.say('⏬');
                creep.memory.moveTicks = 0; // Reset for the next cycle
            }
        }
    },
    
    harvestEnergy: function(creep) {
        if (!creep.memory.moveTicks) {
            creep.memory.moveTicks = 0;
        }
        
        if (creep.memory.moveTicks < 50) {
            // Directly call the utility's harvestEnergy method. This assumes the method handles moveToTarget internally.
            utility.harvestEnergy(creep);
            creep.memory.moveTicks++;
        } else {
            this.manageEnergy(creep);
        }
    },
    chooseSource: function(creep) {
        // This method likely sets a sourceId in creep's memory for the harvestEnergy method to use
        utility.chooseSource(creep);
    },
};

module.exports = roleHarvester;
