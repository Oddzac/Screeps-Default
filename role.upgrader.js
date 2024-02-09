var utility = require('a.utilities');
var roleUpgrader = {
    run: function(creep) {
        if (!creep.memory.sourceId || creep.store.getFreeCapacity() === 0) {
            delete creep.memory.sourceId; // Clear the source ID to re-evaluate next cycle when empty
        }

        if (creep.store.getFreeCapacity() > 0) {
            this.harvestEnergy(creep);
        } else {
            this.upgradeController(creep);
        }
    },


    upgradeController: function(creep) {
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.say('🔋');
            creep.moveTo(creep.room.controller)
            //utility.moveToWithCCM(creep, creep.room.controller);
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
