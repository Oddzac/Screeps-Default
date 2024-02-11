var utility = require('a.utilities');
var roleHauler = {
    run: function(creep) {
        this.manageDroppedEnergyClaims(creep);
        this.handleEnergyCollectionOrDelivery(creep);
    },

    handleEnergyCollectionOrDelivery: function(creep) {
        if (creep.store.getFreeCapacity() > 0) {
            this.collectEnergy(creep);
        } else {
            this.deliverEnergy(creep);
        }
    },

    collectEnergy: function(creep) {
        let target = this.findEnergyCollectionTarget(creep);
        if (target) {
            this.moveToAndCollectEnergy(creep, target);
        } else {
            this.waitStrategically(creep);
        }
    },

    findEnergyCollectionTarget: function(creep) {
        // Prioritize claimed drops, then significant dropped energy, tombstones, and containers
        if (creep.memory.claimedDrop) {
            let claimedTarget = Game.getObjectById(creep.memory.claimedDrop);
            if (claimedTarget) return claimedTarget;
        }
        
        let significantDrop = this.findSignificantDroppedEnergy(creep);
        if (significantDrop) return significantDrop;
        
        let container = this.findClosestContainerWithEnergy(creep);
        if (container) return container;
        
        return null;
    },

    moveToAndCollectEnergy: function(creep, target) {
        if (target instanceof Resource && creep.pickup(target) === ERR_NOT_IN_RANGE ||
            target instanceof Tombstone && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE ||
            target.structureType === STRUCTURE_CONTAINER && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            utility.moveToTarget(creep, target, 1);
            creep.say('🔄️');
        }
    },

    deliverEnergy: function(creep) {
        let target = this.findEnergyDepositTarget(creep);
        if (target && creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            utility.moveToTarget(creep, target, 1);
            creep.say('🚚');
        }
    },

    findSignificantDroppedEnergy: function(creep) {
        // Merged logic for dropped resources and tombstones
        return creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50
        }) || creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] >= 50
        });
    },

    findClosestContainerWithEnergy: function(creep) {
        // Simplified container search
        return creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
    },

    waitStrategically: function(creep) {
        // Simplified wait strategy
        let source = creep.pos.findClosestByPath(FIND_SOURCES);
        if (source) {
            utility.moveToTarget(creep, source, 5); // Reduced range to save CPU on pathfinding
            creep.say('🔎');
        }
    },

    findEnergyDepositTarget: function(creep) {
        // Simplified energy deposit target search
        return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_TOWER) &&
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
    },

    manageDroppedEnergyClaims: function(creep) {
        // Optimized claim management
        if (creep.memory.claimedDrop) {
            let claimedDrop = Game.getObjectById(creep.memory.claimedDrop);
            if (!claimedDrop || claimedDrop.amount === 0) {
                delete Memory.claimedDrops[creep.memory.claimedDrop];
                delete creep.memory.claimedDrop;
            }
        } else {
            // Attempt to claim if there's no current claim and capacity isn't full
            if (creep.store.getFreeCapacity() > 0) {
                this.claimDroppedEnergy(creep);
            }
        }
    },

    claimDroppedEnergy: function(creep) {
        let unclaimedDrops = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50 && (!Memory.claimedDrops[r.id] || Memory.claimedDrops[r.id] === creep.id)
        });
        let closestDrop = creep.pos.findClosestByPath(unclaimedDrops);
        if (closestDrop) {
            Memory.claimedDrops[closestDrop.id] = creep.id;
            creep.memory.claimedDrop = closestDrop.id;
        }
    }
};

module.exports = roleHauler;