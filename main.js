// Import role modules
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleHauler = require('role.hauler');
//var roleMeleeAttacker = require('role.meleeattacker');
//var roleRangedAttacker = require('role.rangedattacker');
//var roleHealer = require('role.healer');

// Main loop
const profiler = require('screeps-profiler');

// This line monkey patches the global prototypes.
profiler.enable();
module.exports.loop = function() {
  profiler.wrap(function() {
   
    // Memory Cleanup
    cleanMemory();
    
    // Initializations for shared knowledge
    if (!Memory.claimedDrops) {
        Memory.claimedDrops = {};
    }
    
    
    updateRoomTerrainData();
    
    if (Game.time % 100 === 0) {
        console.log('Checking for hostiles');
       
        Object.values(Game.rooms).forEach(room => {
            console.log(`Checking ${room.name}`);
            updateRoomSourceSafety(room);
        });
    }
    
        // Periodically update cost matrices for all rooms
    if (Game.time % 5000 === 0) {
        console.log('Updating cost matrices for all rooms...');
       
        for (const roomName in Game.rooms) {
            cacheRoomCostMatrix(roomName); // Assuming this function updates the cost matrix
        }
    }
    
    if (Game.time % 5000 === 0) {
        console.log('AVG Interval Reset');
        Memory.spawnTicks = [];
    }
    

    // Automatically spawn creeps as needed, maintain at least 3 harvesters
    if (_.filter(Game.creeps, (creep) => creep.memory.role === 'harvester').length < 3 && !Game.spawns['Spawn1'].spawning) {
        spawnCreepWithRole('harvester', Game.spawns['Spawn1'].room.energyAvailable);
    } else {
        manageCreepSpawning();
    }
    // Construction 
    manageConstruction();

    // Assign roles to each creep
    assignRolesToCreeps();
  });
}





function assignRolesToCreeps() {
    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        switch (creep.memory.role) {
            case 'harvester': roleHarvester.run(creep); break;
            case 'upgrader': roleUpgrader.run(creep); break;
            case 'builder': roleBuilder.run(creep); break;
            case 'meleeattacker': roleMeleeAttacker.run(creep); break;
            case 'rangedattacker': roleRangedAttacker.run(creep); break;
            case 'healer': roleHealer.run(creep); break;
            case 'hauler': roleHauler.run(creep); break;
            // No default case needed unless you have a generic role to assign
        }
    }
}

function cleanMemory() {
    //Dearly departed, we are gathered here today...
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing creep memory:', name);
        }
    }
    //Old hauler claims
    for (let id in Memory.claimedDrops) {
        if (!Game.getObjectById(id) || Game.getObjectById(id).amount === 0) {
            delete Memory.claimedDrops[id];
        }
    }
    
    for (let id in Memory.repairAssignments) {
        if (!Game.getObjectById(id) || Game.getObjectById(id).amount === 0) {
            delete Memory.repairAssignments[id];
        }
    }
}



// SPAWNING METHODS
//
//
//
//

function calculateDesiredCounts() {
    const totalCreeps = Object.keys(Game.creeps).length;
    // Adjust these ratios as needed based on your gameplay strategy
    return {
        harvester: Math.floor(totalCreeps * 0.2),
        builder: Math.floor(totalCreeps * 0.4),
        hauler: Math.floor(totalCreeps * 0.3),
        upgrader: Math.ceil(totalCreeps * 0.1),
    };
}

function manageCreepSpawning() {
    const averageInterval = spawnClock();
    const energyAvailable = Game.spawns['Spawn1'].room.energyAvailable;
    const energyCapacity = Game.spawns['Spawn1'].room.energyCapacityAvailable;

    // Decide on energy use based on the spawn clock and energy capacity
    if (averageInterval < 150 && averageInterval > 75) {
        // Only proceed with spawning if energy available is at least 83% of capacity
        if (energyAvailable < energyCapacity * 0.84) {
            //console.log(`[manageCreepSpawning] Accumulating Partial: ${energyAvailable} /`, energyCapacity * .84);
            return; // Exit the function early to wait for more energy
        }
    } else if (averageInterval < 76) {
        if (energyAvailable < energyCapacity) {
            //console.log(`[manageCreepSpawning] Accumulating Full: ${energyAvailable} /`, energyCapacity);
            return; // Exit the function early to wait for more energy
        }
    }
    
    let energyToUse = energyAvailable; 

    const energyThresholds = {
        low: 300,
        medium: 550,
        high: 800,
    };

    if (energyCapacity >= energyThresholds.medium && energyAvailable >= energyThresholds.medium) {
        energyToUse = Math.max(energyToUse, energyThresholds.medium);
    } else if (energyCapacity >= energyThresholds.high && energyAvailable >= energyThresholds.high) {
        energyToUse = Math.max(energyToUse, energyThresholds.high);
    }

    //console.log(`[manageCreepSpawning] Avg Interval: ${averageInterval}, Energy Available: ${energyAvailable}, Energy to Use: ${energyToUse}`);

    const desiredCounts = calculateDesiredCounts();
    const currentCounts = _.countBy(Game.creeps, 'memory.role');
    //console.log(`[manageCreepSpawning] Current count: ${JSON.stringify(currentCounts)}, Desired count: ${JSON.stringify(desiredCounts)}`);

    let leastPopulatedRole = null;
    let leastPopulationDifference = Infinity;

    // Determine which role is most in need of spawning
    for (const [role, desiredCount] of Object.entries(desiredCounts)) {
        const currentCount = currentCounts[role] || 0;
        const difference = desiredCount - currentCount;
        if (difference > 0) {
            spawnCreepWithRole(role, energyToUse);
            return;
        } else if (-difference < leastPopulationDifference) {
            leastPopulationDifference = -difference;
            leastPopulatedRole = role;
        }
    }

    // If all roles are overpopulated, spawn for the least populated role
    if (leastPopulatedRole !== null) {
        //console.log(`[manageCreepSpawning] Overpopulation detected. Spawning additional ${leastPopulatedRole} to balance roles.`);
        spawnCreepWithRole(leastPopulatedRole, energyToUse);
    } else {
        console.log("[manageCreepSpawning] No spawning action taken. Adjust desired counts or improve energy management.");
    }
}



// Handles spawning after need and energy are determined.
function spawnCreepWithRole(role, energyAvailable) {
    //console.log(`[spawnCreepWithRole] Attempting to spawn: ${role} with ${energyAvailable} energy`);
    
    const body = getBodyPartsForRole(role, energyAvailable);

    if (!body) {
        // Log or handle the situation when not enough energy is available
        //console.log(`[spawnCreepWithRole] Waiting for more energy to spawn ${role}.`);
        return; // Exit the function early
    }
    
    const name = `${role}_${Game.time}`;
   

    //console.log(`[spawnCreepWithRole] Spawning ${role} with body:`, JSON.stringify(body));
    const spawnResult = Game.spawns['Spawn1'].spawnCreep(body, name, {
        memory: { role: role, working: false }
    });
    if (spawnResult == OK) {
        // Logging the successful spawn with current counts
        const avgInterval = spawnClock();
        const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader').length;
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester').length;
        const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder').length;
        const haulers = _.filter(Game.creeps, (creep) => creep.memory.role === 'hauler').length;
        const totalCreeps = Object.keys(Game.creeps).length;
        console.log(`[spawnCreepWithRole] Spawned ${role} with ${JSON.stringify(body)}`)
        console.log(`[spawnCreepWithRole] Current Worker Counts - Total: ${totalCreeps}, Hv: ${harvesters}, Hl: ${haulers}, B: ${builders}, U: ${upgraders}`);
        Memory.spawnTicks.push(Game.time);
        console.log('Average Tick Interval:', avgInterval);
        
    } else {
        
        console.log(`[spawnCreepWithRole] Failed to spawn ${role}: ${name}, Error: ${spawnResult}`);
    }
}


function getBodyPartsForRole(role, energyAvailable) {
    const partsCost = BODYPART_COST;
    const roleBlueprints = {
        harvester: ["work", "carry", "move"],
        upgrader: ["work", "carry", "move"],
        builder: ["work", "carry", "move"],
        hauler: ["carry", "move", "move"], // Adjusted for balance
    };

    let body = [];
    let energyUsed = 0;

    // Calculate the energy cost for the base blueprint
    const baseCost = roleBlueprints[role].reduce((total, part) => total + partsCost[part], 0);

    if (energyAvailable < baseCost) {
        //console.log(`Insufficient energy to spawn a viable ${role}. Required: ${baseCost}, Available: ${energyAvailable}`);
        return null; // Not enough energy for even a base blueprint
    }

    // Build the base blueprint
    roleBlueprints[role].forEach(part => {
        if (energyUsed + partsCost[part] <= energyAvailable) {
            body.push(part);
            energyUsed += partsCost[part];
        }
    });

    // Function to add parts in a balanced manner
    const addPartsBalanced = () => {
        const blueprint = roleBlueprints[role];
        let added = false;

        for (let i = 0; i < blueprint.length && energyUsed < energyAvailable; i++) {
            const part = blueprint[i];
            if (energyUsed + partsCost[part] <= energyAvailable) {
                body.push(part);
                energyUsed += partsCost[part];
                added = true;
                // Cycle through parts in blueprint order for balance
                i = (i + 1) % blueprint.length - 1;
            }
        }

        return added;
    };

    // Continue adding parts in a balanced way until no more can be added
    while (addPartsBalanced()) {}

    return body;
}

function spawnClock() {
    //Initialize Memory Objects
    if (!Memory.spawnTicks) {
        Memory.spawnTicks = [];
    }
    
    // Calculate the average spawn interval
    if (Memory.spawnTicks.length > 1) {
        let totalIntervals = 0;
        for (let i = 1; i < Memory.spawnTicks.length; i++) {
            totalIntervals += (Memory.spawnTicks[i] - Memory.spawnTicks[i - 1]);
        }
        let averageInterval = totalIntervals / (Memory.spawnTicks.length - 1);
        //console.log('Average ticks between spawns:', averageInterval.toFixed(2));
        return averageInterval;
    } else {
        //console.log('Not enough data to calculate average spawn interval.');
        return 255;
    }
}

global.resetCreepMemory = function() {
    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        var role = creep.memory.role; // Capture the current role before resetting memory
        
        // Clear current memory
        creep.memory = {};
        
        // Set initial memory state based on role
        creep.memory.role = role; // Reassign role
        // Add any other role-specific initialization as needed
        switch (role) {
            case 'harvester':
                // Initialize memory specific to harvesters
                break;
            case 'upgrader':
                // Initialize memory specific to upgraders
                break;
            case 'builder':
                // Initialize memory specific to builders
                break;
            case 'hauler':
                // Initialize memory specific to haulers
                break;
            // Add cases for other roles as necessary
        }
        
        console.log(`Reset memory for ${name} (${role}).`);
    }
}



// MAPPING METHODS
//
//
//
//


function updateRoomSourceSafety(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};

    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const sources = room.find(FIND_SOURCES);
    const ruinsWithEnergy = room.find(FIND_RUINS, {
        filter: (ruin) => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });

    const safeSources = sources.filter(source => 
        !hostiles.some(hostile => source.pos.inRangeTo(hostile, 10))
    ).map(source => source.id);

    const safeRuins = ruinsWithEnergy.map(ruin => ruin.id);

    Memory.rooms[room.name].safeSources = safeSources;
    Memory.rooms[room.name].safeRuins = safeRuins;
}


function updateRoomTerrainData(room) {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        // Check if we already have the terrain data stored
        if (!Memory.terrainData || !Memory.terrainData[roomName]) {
            // If not, retrieve and store it
            const terrain = room.getTerrain();
            Memory.terrainData = Memory.terrainData || {};
            Memory.terrainData[roomName] = [];
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    const terrainType = terrain.get(x, y);
                    // Store terrain type; 0: plain, 1: wall, 2: swamp
                    Memory.terrainData[roomName].push(terrainType);
                }
            }
            console.log(`Terrain data cached for room: ${roomName}`);
            cacheRoomCostMatrix(roomName);
        }
    }
}

function countTerrainAroundPoint(roomName, x, y, range) {
    const terrain = Game.map.getRoomTerrain(roomName);
    let swampCount = 0;
    let wallCount = 0;

    for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
            const type = terrain.get(x + dx, y + dy);
            if (type === TERRAIN_MASK_SWAMP) swampCount++;
            if (type === TERRAIN_MASK_WALL) wallCount++;
        }
    }

    return { swampCount, wallCount };
}

function cacheRoomCostMatrix(roomName) {
    if (!Memory.terrainData || !Memory.terrainData[roomName]) {
        console.log('Terrain data for room not found:', roomName);
        return;
    }

    var terrain = Memory.terrainData[roomName];
    var costMatrix = new PathFinder.CostMatrix();

    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
            var index = y * 50 + x;
            if (terrain[index] === TERRAIN_MASK_WALL) {
                costMatrix.set(x, y, 255); // Impassable
            } else if (terrain[index] === TERRAIN_MASK_SWAMP) {
                costMatrix.set(x, y, 10); // Costly to move through
            } else {
                costMatrix.set(x, y, 2); // Normal cost
            }
        }
    }

    Memory.costMatrices = Memory.costMatrices || {};
    Memory.costMatrices[roomName] = costMatrix.serialize();
}


// CONSTRUCTION METHODS
//
//
//
//

function manageConstruction() { 
    
    if (!Memory.constructionRuns) {
        Memory.constructionRuns = 0;
    }
    
    const buildersCount = _.filter(Game.creeps, { memory: { role: 'builder' } }).length;
    const room = Game.rooms[Object.keys(Game.rooms)[0]] || Game.spawns['Spawn1'].room;
    const activeSites = Object.keys(Game.constructionSites).length;
    
    if (buildersCount < 1) {
        //console.log("Insufficient builders to initiate construction.");
        return;
    }
    if (Memory.constructionRuns < 1) {
        connectSpawnToPOIs(room);
        
    } else if (Memory.constructionRuns === 1 && room.controller.level === 2) {
        placeContainerSites(room);
         Memory.constructionRuns += 1;
        
    } else if (Memory.constructionRuns === 2 && activeSites < 20) {
        placeRoadArraysSmall(room);
        
    } else if (Memory.constructionRuns === 3 && activeSites < 20) {
        connectAllPOIs(room);
        Memory.constructionRuns +=1;
        
    } else if (Memory.constructionRuns === 4 && activeSites < 20) {
        placeRoadArraysLarge(room);
        
    }
}

global.removeAllConstructionSites = function() {
    for (let id in Game.constructionSites) {
        let site = Game.constructionSites[id];
        site.remove();
    }
    Memory.constructionRuns = 0;
    console.log("All construction sites have been removed.");
}

function getTerrainIndex(x, y) {
    return y * 50 + x; // Convert (x, y) position to index in the flat array
}

function getPrioritizedSources(room) {
    const terrainData = Memory.terrainData[room.name];
    let sources = room.find(FIND_SOURCES).map(source => {
        let swampCount = 0;
        let wallCount = 0;
        const range = 2; // Define the range to check around each source

        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const x = source.pos.x + dx;
                const y = source.pos.y + dy;
                if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                    const index = getTerrainIndex(x, y);
                    const terrainType = terrainData[index];
                    if (terrainType === TERRAIN_MASK_SWAMP) swampCount++;
                    if (terrainType === TERRAIN_MASK_WALL) wallCount++;
                }
            }
        }

        return {
            source, // Reference to the source object
            terrainScore: { swampCount, wallCount }
        };
    });

    sources.sort((a, b) => b.terrainScore.swampCount - a.terrainScore.swampCount ||
                          b.terrainScore.wallCount - a.terrainScore.wallCount);

    return sources.map(item => item.source); // Return an array of sources for compatibility
}

function placeRoadArraysLarge(room) {
    if (!room.memory.roadConstructionProgress) {
        room.memory.roadConstructionProgress = { currentIndex: 0, completed: false };
    }

    if (room.memory.roadConstructionProgress.completed) {
        console.log("Road construction around all points has already been completed.");
        return;
    }

    const pattern = [
        [0,0,0,1,1,1,0,0,0], [0,0,1,1,1,1,1,0,0], [0,1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1,1], [1,1,1,1,0,1,1,1,1], [1,1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,1,0], [0,0,1,1,1,1,1,0,0], [0,0,0,1,1,1,0,0,0]
    ];

    // Combine prioritized sources with structures, prioritizing based on terrain if applicable
    const prioritizedSources = getPrioritizedSources(room); // Assuming this returns sources directly if terrain prioritization is enabled
    const structures = room.find(FIND_MY_STRUCTURES, {
        filter: structure => structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_CONTROLLER
    });

    // Ensure points include both sources and structures, handling prioritization seamlessly
    const points = [...prioritizedSources, ...structures];

    let { currentIndex, completed } = room.memory.roadConstructionProgress;

    for (let i = currentIndex; i < points.length && !completed; i++) {
        const point = points[i];

        console.log(`Processing ${point.structureType || 'source'} at (${point.pos.x},${point.pos.y})`);

        pattern.forEach((row, dy) => {
            row.forEach((cell, dx) => {
                if (cell === 1) {
                    const targetX = point.pos.x + (dx - 4);
                    const targetY = point.pos.y + (dy - 4);

                    if (targetX >= 0 && targetX < 50 && targetY >= 0 && targetY < 50) {
                        const result = room.createConstructionSite(targetX, targetY, STRUCTURE_ROAD);
                        if (result === ERR_FULL) {
                            //former location of console log for early return
                            completed = true; // Halt further processing within this tick
                            return; // Early exit from the inner forEach loop
                        }
                    }
                }
            });
            if (completed) return; // Early exit from the outer forEach loop if completed is true
            
        });

        if (!completed) currentIndex = i + 1; // Only increment currentIndex if not completed
        else break; // Break from the for loop if completed
    }

    if (currentIndex >= points.length) {
        console.log("Completed road placement around all points.");
        room.memory.roadConstructionProgress.completed = true;
        Memory.constructionRuns += 1; // Consider moving this increment to where it best indicates completion of all constructions
    } else {
        room.memory.roadConstructionProgress.currentIndex = currentIndex;
    }

    if (completed) {
        // Ensure progress is saved if halted due to ERR_FULL
        console.log(`Construction site limit reached, halting road placement.`);
        room.memory.roadConstructionProgress.completed = completed;
    }
}

function placeRoadArraysSmall(room) {
    if (!room.memory.roadConstructionProgress) {
        room.memory.roadConstructionProgress = { currentIndex: 0, completed: false };
    }

    if (room.memory.roadConstructionProgress.completed) {
        console.log("Road construction around all points has already been completed.");
        return;
    }

    const pattern = [
        [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0], [0,0,0,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,0,0], [0,0,1,1,0,1,1,0,0], [0,0,1,1,1,1,1,0,0],
        [0,0,0,1,1,1,0,0,0], [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0]
    ];

    // Combine prioritized sources with structures, prioritizing based on terrain if applicable
    const prioritizedSources = getPrioritizedSources(room); // Assuming this returns sources directly if terrain prioritization is enabled
    const structures = room.find(FIND_MY_STRUCTURES, {
        filter: structure => structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_CONTROLLER
    });

    // Ensure points include both sources and structures, handling prioritization seamlessly
    const points = [...prioritizedSources, ...structures];

    let { currentIndex, completed } = room.memory.roadConstructionProgress;

    for (let i = currentIndex; i < points.length && !completed; i++) {
        const point = points[i];

        console.log(`Processing ${point.structureType || 'source'} at (${point.pos.x},${point.pos.y})`);

        pattern.forEach((row, dy) => {
            row.forEach((cell, dx) => {
                if (cell === 1) {
                    const targetX = point.pos.x + (dx - 4);
                    const targetY = point.pos.y + (dy - 4);

                    if (targetX >= 0 && targetX < 50 && targetY >= 0 && targetY < 50) {
                        const result = room.createConstructionSite(targetX, targetY, STRUCTURE_ROAD);
                        if (result === ERR_FULL) {
                            //former location of console log for early return
                            completed = true; // Halt further processing within this tick
                            return; // Early exit from the inner forEach loop
                        }
                    }
                }
            });
            if (completed) return; // Early exit from the outer forEach loop if completed is true
            
        });

        if (!completed) currentIndex = i + 1; // Only increment currentIndex if not completed
        else break; // Break from the for loop if completed
    }

    if (currentIndex >= points.length) {
        console.log("Completed road placement around all points.");
        room.memory.roadConstructionProgress.completed = true;
        Memory.constructionRuns += 1; // Consider moving this increment to where it best indicates completion of all constructions
    } else {
        room.memory.roadConstructionProgress.currentIndex = currentIndex;
    }

    if (completed) {
        // Ensure progress is saved if halted due to ERR_FULL
        console.log(`Construction site limit reached, halting road placement.`);
        room.memory.roadConstructionProgress.completed = completed;
    }
}  

function placeContainerSites(room) {
    // Assuming there's only one spawn in the room for simplicity
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return; // Exit if no spawn is found

    const sources = room.find(FIND_SOURCES);
    sources.forEach(source => {
        const path = PathFinder.search(spawn.pos, {pos: source.pos, range: 5}, {
            // Do not consider using roads and avoid swamp tiles
            plainCost: 1,
            swampCost: 5,
            roomCallback: function(roomName) {
                let room = Game.rooms[roomName];
                if (!room) return;
                let costs = new PathFinder.CostMatrix();

                room.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD) {
                        // Favor roads by setting their cost lower than plain tiles
                        costs.set(struct.pos.x, struct.pos.y, 1);
                    } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                               (struct.structureType !== STRUCTURE_RAMPART ||
                                !struct.my)) {
                        // Avoid non-walkable structures
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });

                return costs;
            },
        });

        // Check if a path was found
        if (path.path.length > 0) {
            let targetTile = path.path[path.path.length - 1]; // The tile closest to the spawn within range
            console.log(`Container Placed @ ${targetTile.pos}`);
            // Check if the target tile is suitable (plain or swamp and not already occupied by a construction site or structure)
            let terrain = room.getTerrain().get(targetTile.x, targetTile.y);
            if ((terrain !== TERRAIN_MASK_WALL) && 
                !room.lookForAt(LOOK_STRUCTURES, targetTile.x, targetTile.y).length && 
                !room.lookForAt(LOOK_CONSTRUCTION_SITES, targetTile.x, targetTile.y).length) {
                room.createConstructionSite(targetTile.x, targetTile.y, STRUCTURE_CONTAINER);
            }
        } else {
            console.log('No suitable path found for placing a container near source.');
        }
    });
}

function connectSpawnToPOIs(room) {
    // Ensure memory initialization for construction progress tracking
    if (!Memory.constructionProgress) {
        Memory.constructionProgress = { index: 0, completedTargets: [] };
    }
    let constructionProgress = Memory.constructionProgress;

    // Define POIs: Room Controller, Sources, and specific structures
    const sources = room.find(FIND_SOURCES);
    const structures = room.find(FIND_MY_STRUCTURES, {
        filter: (s) => [STRUCTURE_CONTAINER, STRUCTURE_EXTENSION].includes(s.structureType)
    });
    const targets = [room.controller, ...sources, ...structures];

    if (constructionProgress.completedTargets.length >= targets.length) {
        console.log("All targets connected. Incrementing construction runs.");
        Memory.constructionRuns = (Memory.constructionRuns || 0) + 1;
        Memory.constructionProgress = null; // Reset progress for future operations
        return;
    }

    targets.forEach((target, index) => {
        // Skip already completed targets
        if (constructionProgress.completedTargets.includes(index)) return;

        const path = PathFinder.search(Game.spawns['Spawn1'].pos, { pos: target.pos, range: 1 }, {
            roomCallback: roomName => {
                let costs = new PathFinder.CostMatrix();
                // Adjust to ignore swamp costs, treating all non-wall tiles the same
                room.find(FIND_STRUCTURES).forEach(struct => {
                    if (struct.structureType !== STRUCTURE_CONTAINER &&
                        struct.structureType !== STRUCTURE_RAMPART &&
                        struct.structureType !== STRUCTURE_ROAD &&
                        !struct.my) {
                        // Set impassable structures as impassable
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });
                // Consider terrain to ensure walls are impassable
                let terrain = room.getTerrain();
                for(let y = 0; y < 50; y++) {
                    for(let x = 0; x < 50; x++) {
                        if(terrain.get(x, y) === TERRAIN_MASK_WALL) {
                            costs.set(x, y, 0xff);
                        }
                    }
                }
                return costs;
            }
        }).path;

        // Place roads directly on the path for a single lane
        path.forEach((pos, i) => {
            const x = pos.x;
            const y = pos.y;
            if (room.createConstructionSite(x, y, STRUCTURE_ROAD) === ERR_FULL) {
                // Early exit from forEach, pauses construction if limit reached
                return;
            }

            if (i === path.length - 1) {
                // Mark the target as completed after last path segment is processed
                constructionProgress.completedTargets.push(index);
            }
        });

        // Break early if construction sites limit reached
        if (room.find(FIND_CONSTRUCTION_SITES).length >= 100) {
            console.log(`Pausing construction due to site limit. Incomplete POIs:`, targets.length - constructionProgress.completedTargets.length);
            return false; // Stop further forEach iteration
        }
    });

    // Update memory after iteration
    Memory.constructionProgress = constructionProgress;
}

function connectAllPOIs(room) {
    const sources = room.find(FIND_SOURCES);
    const structures = room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => structure.structureType !== STRUCTURE_ROAD && 
                               structure.structureType !== STRUCTURE_CONTAINER &&
                               structure.structureType !== STRUCTURE_RAMPART
    });

    // Combine sources and structures into a single array of targets
    const targets = [...sources, ...structures];

    // Iterate over each target and create paths to every other target
    targets.forEach((startTarget, startIndex) => {
        targets.slice(startIndex + 1).forEach(endTarget => {
            const path = PathFinder.search(startTarget.pos, { pos: endTarget.pos, range: 1 }, {
                // Define roomCallback to use cost matrix for roads and avoid non-walkable structures
                roomCallback: (roomName) => {
                    let costs = new PathFinder.CostMatrix;
                    room.find(FIND_STRUCTURES).forEach(struct => {
                        if (struct.structureType === STRUCTURE_ROAD) {
                            // Favor roads by setting lower cost
                            costs.set(struct.pos.x, struct.pos.y, 1);
                        } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                                   (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                            // Make non-walkable structures very costly to path through
                            costs.set(struct.pos.x, struct.pos.y, 0xff);
                        }
                    });
                    return costs;
                }
            }).path;

            // Place road construction sites along the path
            path.forEach(pos => {
                const existing = room.lookForAt(LOOK_STRUCTURES, pos).concat(room.lookForAt(LOOK_CONSTRUCTION_SITES, pos));
                if (!existing.length) {
                    room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
                }
            });
        });
    });

    console.log("Room network defined.");
}