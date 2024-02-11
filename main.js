// Import role modules
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleHauler = require('role.hauler');
var construction = require('a.construction');
var spawner = require('a.spawn');
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
        spawner.spawnCreepWithRole('harvester', Game.spawns['Spawn1'].room.energyAvailable);
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
function manageCreepSpawning() {
    const averageInterval = spawner.spawnClock();
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

    const desiredCounts = spawner.calculateDesiredCounts();
    const currentCounts = _.countBy(Game.creeps, 'memory.role');
    //console.log(`[manageCreepSpawning] Current count: ${JSON.stringify(currentCounts)}, Desired count: ${JSON.stringify(desiredCounts)}`);

    let leastPopulatedRole = null;
    let leastPopulationDifference = Infinity;

    // Determine which role is most in need of spawning
    for (const [role, desiredCount] of Object.entries(desiredCounts)) {
        const currentCount = currentCounts[role] || 0;
        const difference = desiredCount - currentCount;
        if (difference > 0) {
            spawner.spawnCreepWithRole(role, energyToUse);
            return;
        } else if (-difference < leastPopulationDifference) {
            leastPopulationDifference = -difference;
            leastPopulatedRole = role;
        }
    }

    // If all roles are overpopulated, spawn for the least populated role
    if (leastPopulatedRole !== null) {
        //console.log(`[manageCreepSpawning] Overpopulation detected. Spawning additional ${leastPopulatedRole} to balance roles.`);
        spawner.spawnCreepWithRole(leastPopulatedRole, energyToUse);
    } else {
        console.log("[manageCreepSpawning] No spawning action taken. Adjust desired counts or improve energy management.");
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
        construction.connectSpawnToPOIs(room);
        
    } else if (Memory.constructionRuns === 1 && room.controller.level === 2) {
        construction.placeContainerSites(room);
         Memory.constructionRuns += 1;
        
    } else if (Memory.constructionRuns === 2 && activeSites < 20) {
        construction.placeRoadArraysSmall(room);
        
    } else if (Memory.constructionRuns === 3 && activeSites < 20) {
        construction.connectAllPOIs(room);
        Memory.constructionRuns +=1;
        
    } else if (Memory.constructionRuns === 4 && activeSites < 20) {
        construction.placeRoadArraysLarge(room);
        
    }
}