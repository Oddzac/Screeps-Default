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
        } else if (!creep.memory.harvesting) {
            this.moveAwayFromSources(creep);
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

        if(structuresNeedingRepair.length > 15 && constructionSites <30) {
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
    
    // Utility function to move the creep away from nearby sources
    moveAwayFromSources: function(creep) {
        const sources = creep.room.find(FIND_SOURCES);
        for (let source of sources) {
            if (creep.pos.getRangeTo(source) <= 2) {
                const fleePath = PathFinder.search(creep.pos, {pos: source.pos, range: 3}, {flee: true}).path;
                if (fleePath.length > 0) {
                    creep.moveByPath(fleePath);
                    return true; // Indicate that the creep is moving away
                }
            }
        }
        return false; // Indicate no need to move away
    },


    performRepair: function(creep) {
        // Count construction sites and damaged structures excluding walls
        const constructionSitesCount = creep.room.find(FIND_CONSTRUCTION_SITES).length;
        const damagedStructuresCount = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.hits < structure.hitsMax && structure.structureType !== STRUCTURE_WALL
        }).length;
    
        // Determine filter criteria based on the current situation
        let repairFilter = (structure) => structure.hits < structure.hitsMax;
        if (constructionSitesCount >= 15 || damagedStructuresCount >= 15) {
            // Focus on repairing roads and excluding walls when there are many construction sites or damaged structures
            repairFilter = (structure) => structure.hits < structure.hitsMax && structure.structureType === STRUCTURE_ROAD;
        }
    
        // Find the closest damaged structure based on the defined filter
        var closestDamagedStructure = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: repairFilter });
    
        if (closestDamagedStructure) {
                if (creep.repair(closestDamagedStructure) === ERR_NOT_IN_RANGE) {
                    utility.moveToTarget(creep, closestDamagedStructure, 3); // Use optimized pathfinding
                    creep.say('🔧');
                }
            } else {
            // If no suitable repair targets, consider switching to building or another task
            creep.say("🚧");
            if (creep.room.find(FIND_CONSTRUCTION_SITES).length > 0) {
                // If there are construction sites, switch to building
                this.performBuild(creep);
            } else {
                // Or, potentially switch to upgrading if nothing to build
                this.performUpgrade(creep);
            }
        }
    },
    
performBuild: function(creep) {
    // Retrieve all construction sites in the room
    let constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);

    // Filter for priority: Closest to completion, Adjacent to sources, Containers or Extensions, Near swamp, Near walls
    let prioritySites = constructionSites.map(site => ({
        site,
        priority: this.calculateConstructionPriority(creep, site)
    })).sort((a, b) => a.priority - b.priority);

    let targetSite = prioritySites.length > 0 ? prioritySites[0].site : null;

    if (targetSite) {
        if (creep.build(targetSite) === ERR_NOT_IN_RANGE) {
            utility.moveToTarget(creep, targetSite, 3); // Use optimized pathfinding
            creep.say('🚧');
        }
    } else {
        // If no construction sites, consider repairing or upgrading
        this.performRepair(creep) || this.performUpgrade(creep);
    }
},

calculateConstructionPriority: function(creep, site) {
    // Priority calculation based on specified rules
    let priority = 0;

    // Closest to completion gets highest priority
    let completionRatio = (site.progressTotal - site.progress) / site.progressTotal;
    priority += completionRatio * 100; // Smaller is better, so we subtract from a base value

    // Check if the site is directly adjacent to sources
    let sources = creep.room.find(FIND_SOURCES);
    let isAdjacentToSource = sources.some(source => site.pos.inRangeTo(source, 1));
    priority += isAdjacentToSource ? -1000 : 0;

    // Prioritize containers or extensions
    if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_EXTENSION) {
        priority -= 500;
    }

    // Check for proximity to swamp or wall tiles for roads
    if (site.structureType === STRUCTURE_ROAD) {
        let surroundingTerrain = creep.room.lookForAtArea(LOOK_TERRAIN, 
            Math.max(site.pos.y - 1, 0), Math.max(site.pos.x - 1, 0), 
            Math.min(site.pos.y + 1, 49), Math.min(site.pos.x + 1, 49), true);

        let isNearSwamp = surroundingTerrain.some(t => t.terrain === 'swamp');
        let isNearWall = surroundingTerrain.some(t => t.terrain === 'wall');
        priority += isNearSwamp ? -600 : 0;
        priority += isNearWall ? -200 : 0;
    }

    return priority;
},



    performUpgrade: function(creep) {
        if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            var target = creep.room.controller
            utility.moveToTarget(creep, target, 3);
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
