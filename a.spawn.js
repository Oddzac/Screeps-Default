var spawner = {
    calculateDesiredCounts: function() {
        const totalCreeps = Object.keys(Game.creeps).length;
        // Adjust these ratios as needed based on your gameplay strategy
        return {
            harvester: Math.floor(totalCreeps * 0.2),
            builder: Math.floor(totalCreeps * 0.3),
            hauler: Math.floor(totalCreeps * 0.4),
            upgrader: Math.ceil(totalCreeps * 0.1),
        };
    },
    
    // Handles spawning after need and energy are determined.
    spawnCreepWithRole: function(role, energyAvailable) {
        //console.log(`[spawnCreepWithRole] Attempting to spawn: ${role} with ${energyAvailable} energy`);
        
        const body = this.getBodyPartsForRole(role, energyAvailable);
    
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
            const avgInterval = this.spawnClock();
            const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader').length;
            const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester').length;
            const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder').length;
            const haulers = _.filter(Game.creeps, (creep) => creep.memory.role === 'hauler').length;
            const totalCreeps = Object.keys(Game.creeps).length;
            console.log(`[spawnCreepWithRole] Spawned ${role} with ${JSON.stringify(body)}`)
            console.log(`[spawnCreepWithRole] Current Worker Counts - Total: ${totalCreeps}, Hv: ${harvesters}, Hl: ${haulers}, B: ${builders}, U: ${upgraders}`);
            Memory.spawnTicks.push(Game.time);
            console.log(`Average spawn rate interval: ${avgInterval} ticks`);
            
        } else {
            
            console.log(`[spawnCreepWithRole] Failed to spawn ${role}: ${name}, Error: ${spawnResult}`);
        }
    },
    
    getBodyPartsForRole: function(role, energyAvailable) {
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
    },
    
    spawnClock: function() {
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
    },
};

module.exports = spawner;