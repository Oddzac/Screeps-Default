var utility = require('a.utilities');
var roleUpgrader = {
    run: function(creep) {
        // Initialize harvestingTicks if it doesn't exist
        if (!creep.memory.harvestingTicks) {
            creep.memory.harvestingTicks = 0;
        }

        // Check if the creep is currently harvesting or needs to start harvesting
        if(creep.store.getUsedCapacity() < creep.store.getCapacity() && !creep.memory.harvesting) {
            creep.memory.harvesting = true;
        }

        // Switch to upgrading if the creep's store is more than 50% full or it has been trying to harvest for more than 10 ticks
        if (creep.store.getUsedCapacity() > creep.store.getCapacity() * 0.9 || creep.memory.harvestingTicks > 50) {
            creep.memory.harvesting = false;
        }

        // If the creep is harvesting but its store is full, switch to not harvesting
        if (creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            // Reset harvestingTicks since the creep is now switching tasks
            creep.memory.harvestingTicks = 0;
        }

        if (creep.memory.harvesting) {
            this.harvestEnergy(creep);
            // Increment the harvestingTicks counter if still harvesting
            creep.memory.harvestingTicks++;
        } else {
            this.upgradeController(creep);
            // Reset harvestingTicks since the creep is now upgrading
            creep.memory.harvestingTicks = 0;
        }
    },

    upgradeController: function(creep) {
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.say('🔋');
            utility.moveToTarget(creep, creep.room.controller, 3);
        }
    },
    
    harvestEnergy: function(creep) {
        utility.harvestEnergy(creep);
    },
    
    chooseSource: function(creep) {
        utility.chooseSource(creep);
    },
};

module.exports = roleUpgrader;
