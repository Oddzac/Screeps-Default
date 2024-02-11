var utilities = {
    harvestEnergy: function(creep) {
        // Re-evaluate source choice if hostiles are nearby.
        var hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 15);
        if (hostiles.length > 0 && !creep.memory.avoidingHostiles) {
            console.log(`[${creep.name}] Avoiding hostiles, re-evaluating source.`);
            creep.memory.avoidingHostiles = true;
            delete creep.memory.sourceId;
        } else if (hostiles.length === 0 && creep.memory.avoidingHostiles) {
            console.log(`[${creep.name}] No longer avoiding hostiles.`);
            creep.memory.avoidingHostiles = false;
        }
    
        if (!creep.memory.sourceId) {
            //console.log(`[${creep.name}] Selecting new source.`);
            let target = this.chooseSource(creep);
            if (target) {
                //console.log(`[${creep.name}] New source selected: ${target.id}`);
                creep.memory.sourceId = target.id;
                creep.memory.sourceType = (target instanceof Source) ? 'source' : 'structure';
            } else {
                //console.log(`[${creep.name}] No source found.`);
                return;
            }
        }
    
        let target = Game.getObjectById(creep.memory.sourceId);
        if (!target) {
            //console.log(`[${creep.name}] Target source/structure not found, clearing memory.`);
            delete creep.memory.sourceId;
            delete creep.memory.sourceType;
            return;
        }
    
        let actionResult;
        if (creep.memory.sourceType === 'source') {
            actionResult = creep.harvest(target);
            creep.say('⛏️');
        } else {
            actionResult = creep.withdraw(target, RESOURCE_ENERGY);
            creep.say('✨');
        }
    
        if (actionResult === ERR_NOT_IN_RANGE) {
            //console.log(`[${creep.name}] Moving towards target.`);
            this.moveToTarget(creep, target, 1);
        } else if (actionResult !== OK) {
            console.log(`[${creep.name}] Action failed with error: ${actionResult}, re-evaluating source.`);
            delete creep.memory.sourceId;
            delete creep.memory.sourceType;
        }
    },
    
    chooseSource: function(creep) {
        const safeRuins = (Memory.rooms[creep.room.name] && Memory.rooms[creep.room.name].safeRuins) ? Memory.rooms[creep.room.name].safeRuins : [];
        for (let id of safeRuins) {
            let ruin = Game.getObjectById(id);
            if (ruin && ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                //console.log(`[${creep.name}] Targeting ruin for harvest: ${id}`);
                return ruin;
            }
        }
    
        const safeSources = (Memory.rooms[creep.room.name] && Memory.rooms[creep.room.name].safeSources) ? Memory.rooms[creep.room.name].safeSources : [];
        for (let id of safeSources) {
            let source = Game.getObjectById(id);
            if (source) {
                //console.log(`[${creep.name}] Targeting source for harvest: ${id}`);
                return source;
            }
        }
    
        const closestSafeSource = creep.pos.findClosestByPath(safeSources.map(id => Game.getObjectById(id)).filter(Boolean));
        if (closestSafeSource) {
            //console.log(`[${creep.name}] Defaulting to closest safe source: ${closestSafeSource.id}`);
            return closestSafeSource;
        }
    
        console.log(`[${creep.name}] Final fallback to any source.`);
        return creep.pos.findClosestByPath(FIND_SOURCES);
    },
// PATH CACHING AND MOVEMENT
//
//
//
//
    
    // Method to find or cache a path
    findCachedPath: function(creep, target) {
        const pathKey = `${creep.pos.roomName}_${creep.pos.x},${creep.pos.y}_${target.x},${target.y}`;
        if (!Memory.pathCache) Memory.pathCache = {};
        if (Memory.pathCache[pathKey] && Memory.pathCache[pathKey].time + 1500 > Game.time) {
            return PathFinder.deserializePath(Memory.pathCache[pathKey].path);
        } else {
            const path = creep.pos.findPathTo(target, {serialize: true, range: 1});
            Memory.pathCache[pathKey] = {
                path: path,
                time: Game.time
            };
            return path;
        }
    },

    // Method for creep movement using cached paths
    moveCreepByCachedPath: function(creep, target, defaultRange = 0) {
        const targetPos = target.pos || target; // Ensure targetPos is a RoomPosition or has a pos attribute
        const effectiveRange = target.range !== undefined ? target.range : defaultRange;
        const pathKey = `${creep.pos.roomName}_${targetPos.x}_${targetPos.y}_${effectiveRange}`;
    
//        console.log(`[${creep.name}] PathKey for movement: ${pathKey}`);
    
        if (!Memory.pathCache) Memory.pathCache = {};
    
        // Check if the path is cached and still valid
        if (Memory.pathCache[pathKey] && Memory.pathCache[pathKey].time + 1500 > Game.time) {
//            console.log(`[${creep.name}] Using cached path.`);
            // Deserialize the path before using it
            const path = Room.deserializePath(Memory.pathCache[pathKey].path);
            const moveResult = creep.moveByPath(path);
            if (moveResult !== OK) {
//                console.log(`[${creep.name}] moveByPath failed with code: ${moveResult}`);
                // Clear the cache if the path is invalid and find a new path immediately
                delete Memory.pathCache[pathKey];
                // Optionally, find a new path immediately and move along it
                const newPath = creep.pos.findPathTo(targetPos, {range: effectiveRange});
                creep.moveByPath(newPath);
            }
        } else {
//            console.log(`[${creep.name}] Generating new path.`);
            const newPath = creep.pos.findPathTo(targetPos, {range: effectiveRange});
            // Serialize the new path for caching
            const serializedPath = Room.serializePath(newPath);
            Memory.pathCache[pathKey] = { path: serializedPath, time: Game.time };
            // Attempt to move along the newly created path
            const moveResult = creep.moveByPath(newPath);
            if (moveResult !== OK) {
//                console.log(`[${creep.name}] moveByPath (new path) failed with code: ${moveResult}`);
            }
        }
    },
    
    // Optional: Method to generate and cache room cost matrices for more efficient pathfinding
    getCostMatrix: function(roomName) {
    if (!Memory.costMatrices) Memory.costMatrices = {};
    if (Memory.costMatrices[roomName] && Memory.costMatrices[roomName].time + 10000 > Game.time) {
        return PathFinder.CostMatrix.deserialize(Memory.costMatrices[roomName].matrix);
    } else {
        const room = Game.rooms[roomName];
        let costs = new PathFinder.CostMatrix();

        if (room) { // Check if the room is visible
            room.find(FIND_STRUCTURES).forEach(function(struct) {
                if (struct.structureType === STRUCTURE_ROAD) {
                    // Favor roads
                    costs.set(struct.pos.x, struct.pos.y, 1);
                } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                        (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                    // Avoid non-walkable structures
                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                }
            });
        } else {
           
//            console.log('getCostMatrix: Room not visible', roomName);
            
        }

        Memory.costMatrices[roomName] = {
            matrix: costs.serialize(),
            time: Game.time
        };
        return costs;
    }
},

   // Enhanced moveToTarget method to handle dynamic pathfinding
    moveToTarget: function(creep, target, range = 0) {
        const targetPos = (target instanceof RoomPosition) ? target : target.pos;
        if (!targetPos) {
//            console.error(`[moveToTarget] Invalid target passed for ${creep.name}.`);
            return;
        }
    
//        console.log(`[${creep.name}] Moving to target at ${targetPos} with range ${range}.`);
        this.moveCreepByCachedPath(creep, { pos: targetPos, range: range });
    },    
    // Method to find and cache a new path if the current one is obstructed
    findAndCacheNewPath: function(creep, targetPos, range) {
        const pathKey = this.generatePathKey(creep.pos, targetPos, range);
        const path = creep.pos.findPathTo(targetPos, { range: range });
        const serializedPath = Room.serializePath(path);
        Memory.pathCache[pathKey] = { path: serializedPath, time: Game.time };
    },
    
    // Utility method to generate a unique key for caching paths
    generatePathKey: function(fromPos, toPos, range) {
        return `${fromPos.roomName}_${fromPos.x},${fromPos.y}_${toPos.x},${toPos.y}_${range}`;
    },
    
};

module.exports = utilities;
