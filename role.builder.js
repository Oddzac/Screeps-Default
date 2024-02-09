var utility = require('a.utilities');
var roleBuilder = {
    run: function(creep) {
        if (!creep.memory.sourceId || creep.store.getFreeCapacity() === 0) {
            delete creep.memory.sourceId; // Clear the source ID to re-evaluate next cycle when empty
        }

        if(creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
        } else if(!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
        }

        if(creep.memory.harvesting) {
            this.harvestEnergy(creep);
        } else {
            this.performTask(creep);
        }
    },


    performTask: function(creep) {
        var structuresNeedingRepair = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.hits < structure.hitsMax
        });
        var constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);

        if(structuresNeedingRepair.length > 15) {
            creep.say("🛠️");
            creep.memory.task = "repairing";
        } else if(constructionSites.length > 0) {
            creep.say("🚧");
            creep.memory.task = "building";
        } else {
            creep.memory.task = "upgrading";
        }

        switch(creep.memory.task) {
            case "repairing":
                this.performRepair(creep);
                break;
            case "building":
                this.performBuild(creep);
                break;
            case "upgrading":
                this.performUpgrade(creep);
                break;
        }
    },

performRepair: function(creep) {
    // Count construction sites and damaged structures excluding walls
    const constructionSitesCount = creep.room.find(FIND_CONSTRUCTION_SITES).length;
    const damagedStructuresCount = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.hits < structure.hitsMax && structure.structureType !== STRUCTURE_WALL
    }).length;

    // Define filter criteria based on the counts
    let repairFilter;
    if (constructionSitesCount < 15 && damagedStructuresCount < 15) {
        // If criteria are met, allow repairing all structures
        repairFilter = (structure) => structure.hits < structure.hitsMax;
    } else if (constructionSitesCount <30) {
        // Otherwise, focus on roads and exclude walls
        repairFilter = (structure) => structure.hits < structure.hitsMax && structure.structureType !== STRUCTURE_WALL;
    } else {
        creep.say("🚧");
        creep.memory.task = "building";
        this.performBuild(creep);        
        
    }

    // Find the closest damaged structure based on the defined filter
    var closestDamagedStructure = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: repairFilter });

    if (closestDamagedStructure) {
        if (creep.repair(closestDamagedStructure) == ERR_NOT_IN_RANGE) {
            creep.moveTo(closestDamagedStructure);
            //utility.moveToWithCCM(creep, closestDamagedStructure);
            creep.say('🔧');
        }
    } else {
        // Optionally, you can add logic here for what the builder should do if no suitable repair targets are found
    
        creep.say("🚧");
        creep.memory.task = "building";
        this.performBuild(creep);
    }
},


performBuild: function(creep) {
    // Retrieve all construction sites in the room
    var constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);

    // Filter construction sites that are too close to hostiles
    constructionSites = constructionSites.filter(site => {
        var hostiles = site.pos.findInRange(FIND_HOSTILE_CREEPS, 15);
        return hostiles.length === 0; // Keep the site if no hostiles are within 15 tiles
    });

    if(constructionSites.length === 0) {
        return; // Early exit if there are no suitable construction sites
    }

    // Prioritize sites based on existing criteria
    var prioritizedSites = constructionSites.map(site => {
        var swampCount = this.countSurroundingSwampTiles(site.pos, creep.room.name);
        var wallCount = this.countSurroundingWallTiles(site.pos, creep.room.name);
        var progressRatio = site.progress / site.progressTotal;
        return { site: site, swampCount: swampCount, wallCount: wallCount, progressRatio: progressRatio };
    }).sort((a, b) => {
        // Sort logic remains unchanged
        if (b.swampCount !== a.swampCount) {
            return b.swampCount - a.swampCount;
        } else if (b.wallCount !== a.wallCount) {
            return b.wallCount - a.wallCount;
        } else {
            return b.progressRatio - a.progressRatio;
        }
    });

    var targetSite = prioritizedSites[0].site;
    if (creep.build(targetSite) === ERR_NOT_IN_RANGE) {
        creep.moveTo(targetSite);
        creep.say('🚧');
    }
},
    countSurroundingWallTiles: function(position, roomName) {
    var wallCount = 0;
    var terrain = new Room.Terrain(roomName);

    for(let dx = -1; dx <= 1; dx++) {
        for(let dy = -1; dy <= 1; dy++) {
            if(dx === 0 && dy === 0) continue; // Skip the center tile
            var x = position.x + dx;
            var y = position.y + dy;

            if(x >= 0 && x < 50 && y >= 0 && y < 50 && terrain.get(x, y) === TERRAIN_MASK_WALL) {
                wallCount++;
            }
        }
    }

    return wallCount;
},
    
    countSurroundingSwampTiles: function(pos, roomName) {
        // Retrieve the cached terrain data for the room
        var terrainData = Memory.terrainData[roomName];
        var swampCount = 0;
    
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                var x = pos.x + dx;
                var y = pos.y + dy;
                // Ensure we're within bounds of the room
                if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                    // Convert 2D coordinates to the index in the flattened terrain data array
                    var index = y * 50 + x;
                    if (terrainData && terrainData[index] == TERRAIN_MASK_SWAMP) {
                        swampCount++;
                    }
                }
            }
        }
        return swampCount;
    },

    performUpgrade: function(creep) {
        if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller);
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

module.exports = roleBuilder;
