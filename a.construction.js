var construction = {
    
    removeAllConstructionSites: function(){
        for (let id in Game.constructionSites) {
            let site = Game.constructionSites[id];
            site.remove();
        }
        Memory.constructionRuns = 0;
        console.log("All construction sites have been removed.");
    },

    getTerrainIndex: function(x, y) {
        return y * 50 + x; // Convert (x, y) position to index in the flat array
    },
    
    getPrioritizedSources: function(room) {
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
    },
    
    placeRoadArraysLarge: function(room) {
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
    },
    
    placeRoadArraysSmall: function(room) {
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
    },  
    
    placeContainerSites: function(room) {
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
    },
    
    connectSpawnToPOIs: function(room) {
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
    },
    
    connectAllPOIs: function(room) {
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
    },

};

module.exports = construction;
