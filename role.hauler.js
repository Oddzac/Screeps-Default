var utility = require('a.utilities');
var roleHauler = {
    run: function(creep) {
        // First, manage any energy drop claims to ensure updated claims
        this.manageDroppedEnergyClaims(creep);

        // Assign a source if it's not already assigned or if the previous one is invalid
        if (!creep.memory.assignedSourceId || !Game.getObjectById(creep.memory.assignedSourceId)) {
            this.assignSource(creep);
        }

        // Explicitly manage state transitions based on the current situation
        if (creep.memory.claimedDrop && creep.store.getUsedCapacity() < creep.store.getCapacity()) {
            // Priority is given to collecting a claimed drop
            this.moveToAndCollectClaimedDrop(creep);
        } else if (creep.store.getUsedCapacity() > 0) {
            // Once the hauler is carrying energy, it should deliver it
            this.deliverEnergy(creep);
        } else {
            // If not actively hauling or claiming, either wait near the source or check for new drops
            if (creep.memory.waitingForDrop) {
                this.waitNearSource(creep);
            } else {
                this.checkForNearbyDroppedEnergy(creep);
            }
        }
    },


    assignSource: function(creep) {
        var sources = creep.room.find(FIND_SOURCES);
        var assignedSource = sources.reduce((leastCrowded, source) => {
            var haulerCount = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.assignedSourceId === source.id).length;
            return haulerCount < leastCrowded.count ? {source: source, count: haulerCount} : leastCrowded;
        }, {source: null, count: Infinity}).source;

        if (assignedSource) {
            creep.memory.assignedSourceId = assignedSource.id;
        }
    },

    waitNearSource: function(creep) {
        let source = Game.getObjectById(creep.memory.assignedSourceId);
        if (source) {
            let path = PathFinder.search(creep.pos, {pos: source.pos, range: 10});
            let waitPosition = path.path[path.path.length - 1];
            if (creep.pos.getRangeTo(waitPosition) > 0) {
                creep.moveTo(waitPosition);
                //utility.moveToWithCCM(creep, waitPosition);
                creep.say('⏳');
            }
        }
    },
    
    moveToAndCollectClaimedDrop: function(creep) {
        var claimedDrop = Game.getObjectById(creep.memory.claimedDrop);
        if (claimedDrop) {
            if (creep.pickup(claimedDrop) === ERR_NOT_IN_RANGE) {
                creep.moveTo(claimedDrop);
                //utility.moveToWithCCM(creep, claimedDrop);
                creep.say('🔄');
            }
        } else {
            // Clear the claim if the drop no longer exists or has been collected
            delete Memory.claimedDrops[creep.memory.claimedDrop];
            delete creep.memory.claimedDrop;
            creep.memory.waitingForDrop = true; // Return to waiting state
        }
    },
    
    deliverEnergy: function(creep) {
        var target = this.findEnergyDepositTarget(creep);
        if (target && creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            //utility.moveToWithCCM(creep, target);
            creep.say('🚚');
        }
        // After attempting delivery, if still carrying energy, continue to deliver
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.waitingForDrop = true; // Ready to collect more energy
        }
    },


    findEnergyDepositTarget: function(creep) {
        return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN || 
                        structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_TOWER) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
    },

    checkForNearbyDroppedEnergy: function(creep) {
        // Prevent all haulers from reacting to the same drop
        var droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount >=5 && !Memory.claimedDrops[resource.id]
        });
        if (droppedEnergy) {
            Memory.claimedDrops[droppedEnergy.id] = creep.id;
            creep.memory.claimedDrop = droppedEnergy.id;
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy);
                //utility.moveToWithCCM(creep, droppedEnergy);
                creep.say('🔄');
            }
        }
    },
    
    manageDroppedEnergyClaims: function(creep) {
        // Clear claims for resources that no longer exist or have been picked up
        for (let id in Memory.claimedDrops) {
            if (!Game.getObjectById(id) || Game.getObjectById(id).amount === 0) {
                delete Memory.claimedDrops[id];
            }
        }

        if (creep.store.getUsedCapacity() === 0 && !creep.memory.claimedDrop) {
            this.claimDroppedEnergy(creep);
        } else if (creep.memory.claimedDrop && creep.store.getUsedCapacity() > 0) {
            // Drop has been picked up, clear the claim
            delete Memory.claimedDrops[creep.memory.claimedDrop];
            delete creep.memory.claimedDrop;
        }
    },

    claimDroppedEnergy: function(creep) {
        var unclaimedDrops = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY && !Memory.claimedDrops[resource.id]
        });
        var closestDrop = creep.pos.findClosestByPath(unclaimedDrops);
        if (closestDrop) {
            Memory.claimedDrops[closestDrop.id] = creep.id; // Claim the drop for this creep
            creep.memory.claimedDrop = closestDrop.id; // Mark the creep with the claimed drop
            creep.moveTo(closestDrop);
            //utility.moveToWithCCM(creep, closestDrop);
            creep.say('🔄');
        }
    },

};

module.exports = roleHauler;
