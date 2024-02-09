var utilities = {
harvestEnergy: function(creep) {
    // Check and increment a counter for how many ticks we've been trying to harvest
    if (!creep.memory.harvestingTicks) {
        creep.memory.harvestingTicks = 0;
    }

    // Check for hostiles nearby
    var hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 15); // Set range to reevaluate here
    if (hostiles.length > 0) {
        // Hostiles are nearby, choose a new source
        let source = this.chooseSource(creep);
        if (source) { // Ensure source is valid before accessing its id
            creep.memory.sourceId = source.id;
            creep.memory.harvestingTicks = 0; // Reset the counter for the new source
            creep.memory.failedSourceAttempts = 0; // Reset failed attempts counter
        } else {
            // Handle case where no source is found
            console.log(`No safe source found for ${creep.name}, hostiles nearby.`);
            return; // Exit early to avoid attempting to harvest this tick
        }
    }

    if (!creep.memory.sourceId || creep.memory.harvestingTicks > 100) {
        let source = this.chooseSource(creep);
        if (source) { // Ensure source is valid before accessing its id
            creep.memory.sourceId = source.id;
            creep.memory.harvestingTicks = 0; // Reset the counter
            creep.memory.failedSourceAttempts = 0; // Reset failed attempts counter
        } else {
            // Increment failed attempts counter
            creep.memory.failedSourceAttempts = (creep.memory.failedSourceAttempts || 0) + 1;
            // Check if failed attempts have reached the threshold
            if (creep.memory.failedSourceAttempts >= 5) {
                console.log(`${creep.name} self-destructing due to inability to find a source.`);
                creep.suicide();
                return;
            }
            console.log(`No source found for ${creep.name}, reevaluating. Failed attempts: ${creep.memory.failedSourceAttempts}`);
            return;
        }
    }

    let source = Game.getObjectById(creep.memory.sourceId);
    if (source) {
        const harvestResult = creep.harvest(source);
        if (harvestResult == ERR_NOT_IN_RANGE) {
            creep.say('⛏️️');
            creep.moveTo(source);
            creep.memory.harvestingTicks++;
        } else if (harvestResult == OK) {
            creep.memory.harvestingTicks = 0;
        }
    } else {
        // Source not found or invalid, force reevaluation
        delete creep.memory.sourceId;
        creep.memory.harvestingTicks = 0;
        // Reset failed attempts counter since source is invalid
        creep.memory.failedSourceAttempts = 0;
    }
},


    chooseSource: function(creep) {
    var sources = creep.room.find(FIND_SOURCES);
    var hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    var terrain = creep.room.getTerrain();

    // Define safeSources outside the conditional blocks to be accessible throughout
    var safeSources = sources.filter(source => !hostiles.some(hostile => source.pos.inRangeTo(hostile, 10)));

    if (creep.memory.role === 'builder') {
        // For builders, find the closest safe source directly
        var closestSafeSource = creep.pos.findClosestByPath(safeSources);
        if (closestSafeSource) {
            creep.memory.targetSourceId = closestSafeSource.id;
            return closestSafeSource;
        }
    } else {
        // For other roles, evaluate sources based on distance, crowdedness, and swamp avoidance
        var evaluatedSources = safeSources.map(source => {
            var distance = creep.pos.getRangeTo(source);
            var crowdedness = _.filter(Game.creeps, c => c.memory.targetSourceId === source.id).length;
            // Check the area around the source for swamp tiles
            var swampTiles = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (terrain.get(source.pos.x + dx, source.pos.y + dy) === TERRAIN_MASK_SWAMP) {
                        swampTiles++;
                    }
                }
            }
            // Score is adjusted to also consider swamp tiles, prioritizing fewer swamps
            return {
                source: source,
                score: crowdedness + distance / 50 + swampTiles * 10 // Adjust weighting as needed
            };
        });

        evaluatedSources.sort((a, b) => a.score - b.score);

        if (evaluatedSources.length > 0) {
            creep.memory.targetSourceId = evaluatedSources[0].source.id;
            return evaluatedSources[0].source;
        }
    }

    // Fallback to closest source by path if no safe sources are found or for builders with no safe sources in range
    var closestSource = creep.pos.findClosestByPath(sources);
    if (closestSource) {
        creep.memory.targetSourceId = closestSource.id;
    }
    return closestSource;
},


    
//    moveToWithCCM: function(creep, target) {
//        
//    },

};

module.exports = utilities;
