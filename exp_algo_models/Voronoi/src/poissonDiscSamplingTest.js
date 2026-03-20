//For gridsize for room cells
const WIDTH = 16;
const HEIGHT = 16;

let numPoints = 0;

let canvas = document.getElementById("map");
let ctx = canvas.getContext('2d');

function randomHSL() {
    const HUE = Math.floor(Math.random() * 361);
    const SATURATION = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
    const LIGHTNESS = Math.floor(Math.random() * (80 - 20  + 1)) + 20;

    return `hsl(${HUE}, ${SATURATION}%, ${LIGHTNESS}%)`;
}

function randomPoints(width, height, k = 100){
    let points = [];
    for(let i = 0; i < k; i++){
        points.push({
            x: Math.random() * width,
            y: Math.random() * height
        });
        numPoints++;
    }
    return points;
}

function poissonDiskSampling(width, height, radius, k = 30) {

    const cellSize = radius / Math.sqrt(2);
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);

    const grid = new Array(gridWidth * gridHeight).fill(null);
    const points = [];
    const active = [];

    function gridIndex(x, y) {
        return Math.floor(x / cellSize) + Math.floor(y / cellSize) * gridWidth;
    }

    function insertPoint(p) {
        points.push(p);
        active.push(p);
        grid[gridIndex(p.x, p.y)] = p;
        numPoints++;
    }

    function isValid(p) {

        const gx = Math.floor(p.x / cellSize);
        const gy = Math.floor(p.y / cellSize);

        for (let x = gx - 2; x <= gx + 2; x++) {
            for (let y = gy - 2; y <= gy + 2; y++) {

                if (x >= 0 && y >= 0 && x < gridWidth && y < gridHeight) {
                    const neighbor = grid[x + y * gridWidth];

                    if (neighbor) {
                        const dx = neighbor.x - p.x;
                        const dy = neighbor.y - p.y;
                        if (dx * dx + dy * dy < radius * radius) {
                            return false;
                        }
                    }
                }

            }
        }

        return true;
    }

    insertPoint({
        x: Math.random() * width,
        y: Math.random() * height
    });
    
    while (active.length > 0) {

        console.log(`Active points: ${active.length}`);
        const index = Math.floor(Math.random() * active.length);
        console.log(`Index from active points: ${index}`);
        
        const point = active[index];

        let found = false;

        for (let i = 0; i < k; i++) {

            const angle = Math.random() * Math.PI * 2;
            const r = radius * (1 + Math.random());

            const candidate = {
                x: point.x + Math.cos(angle) * r,
                y: point.y + Math.sin(angle) * r
            };

            if (
                candidate.x >= 0 &&
                candidate.y >= 0 &&
                candidate.x < width &&
                candidate.y < height &&
                isValid(candidate)
            ) {
                insertPoint(candidate);
                found = true;
                break;
            }
        }

        if (!found) {
            active.splice(index, 1);
        }
    }
    console.log(`Active points after loop: ${active.length}`);
    return points;
}

//START OF SAMPLINGS(POINTS) GENERATION
const points = poissonDiskSampling(WIDTH, HEIGHT, 3, 30);
/* const points = randomPoints(10, 10, 3); */
const delaunay = Delaunator.from(points, loc => loc.x, loc => loc.y);

ctx.save();
ctx.scale(canvas.width / WIDTH, canvas.height / HEIGHT);
ctx.fillStyle = randomHSL();
for (let point of points) {
    const {x, y} = point;
    ctx.beginPath();
    ctx.arc(x, y, 0.1, 0, 2 * Math.PI);
    ctx.fill();
}
ctx.restore();
console.log(`NUMBER OF POINTS ${numPoints}`);


//TRYING TO IMPLEMENT THE TRIANGULATION

function calculateCentroids(points, delaunay) {
    const numTriangles = delaunay.halfedges.length / 3;
    let centroids = [];
    for (let t = 0; t < numTriangles; t++){
        let sumOfX = 0, sumOfY = 0;
        for (let i = 0; i < 3; i++){
            let s = 3*t + i;
            let p = points[delaunay.triangles[s]];
            sumOfX += p.x; 
            sumOfY += p.y;
        }
        centroids[t] = {x: sumOfX / 3, y: sumOfY / 3};
    }//End of outer loop
    return centroids;
}

function triangleOfEdge(e) {
    return Math.floor(e / 3);
}

let map = {
    points,
    numRegions: points.length,
    numTriangles: delaunay.halfedges.length / 3,
    numEdges: delaunay.halfedges.length,
    halfedges: delaunay.halfedges,
    triangles: delaunay.triangles,
    centers: calculateCentroids(points, delaunay),
};

function drawCellBoundaries(canvas, map) {
    let { points, centers, halfedges, triangles, numEdges} = map;
    let ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width / WIDTH, canvas.height / HEIGHT);
    ctx.lineWidth = 0.02;
    ctx.strokeStyle = "black";
    for (let e = 0; e < numEdges; e++) {
        if (e < halfedges[e]) {
            const p = centers[triangleOfEdge(e)];
            const q = centers[triangleOfEdge(halfedges[e])];
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
        }
    }
    ctx.restore();
}

//drawCellBoundaries(canvas, map);

//NORMALIZATION AND GRAPHING

function distance(p1, p2) { 
    return Math.hypot(p1.x - p2.x, p1.y - p2.y); 
}

function extractEdges(triangles) {
    const edges = [];

    for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i];
        const b = triangles[i + 1];
        const c = triangles[i + 2];

        edges.push({ a: a, b: b });
        edges.push({ a: b, b: c });
        edges.push({ a: c, b: a });
    }

    return edges;
}

function removeDuplicateEdges(edges) {
    const unique = new Map();

    for (let edge of edges) {
        let a = Math.min(edge.a, edge.b);
        let b = Math.max(edge.a, edge.b);

        const key = `${a}-${b}`;

        if(!unique.has(key)) {
            unique.set(key, {a, b});
        }
    }
    return Array.from(unique.values());
}



function addWeights(edges, points){
    return edges.map(edge => {
        const p1 = points[edge.a];
        const p2 = points[edge.b];

        return {
            a: edge.a,
            b: edge.b,
            weight: distance(p1, p2)
        };
    });
}

//Graph
const rawEdges = extractEdges(map.triangles);
const cleanEdges = removeDuplicateEdges(rawEdges);
const weightedEdges = addWeights(cleanEdges, points);

console.log(`Raw edges: ${rawEdges.length}`);
console.log(`Clean edges: ${cleanEdges}`);
console.log(`Weighted edges: ${weightedEdges}`);


function kruskal(nodes, edges) {
    const mst = [];
    
    //Sort edges by weight (shortest first)
    const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);

    //Initialize Disjoint Set (DSU) Each node starts as its own parent (its own "group")
    const parent = nodes.map((_, i) => i);

    function find(i) {
        if (parent[i] === i) return i;
        return parent[i] = find(parent[i]);
    }

    function union(i, j) {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) {
            parent[rootI] = rootJ;
            return true;
        }
        return false;
    }

    for (const edge of sortedEdges) {
        //If nodes 'a' and 'b' are not in the same group, connect them
        if (union(edge.a, edge.b)) {
            mst.push(edge);
            if (mst.length === nodes.length - 1) break;
        }
    }

    return mst;
}

//ADD LOOPS
function addBackEdges(allEdges, mstEdges, percentage = 0.1) {
    const mstSet = new Set(mstEdges.map(e => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`));
    const remainingEdges = allEdges.filter(e => !mstSet.has(`${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`));
    
    const extraCount = Math.floor(remainingEdges.length * percentage);
    const shuffled = remainingEdges.sort(() => 0.5 - Math.random());
    
    return mstEdges.concat(shuffled.slice(0, extraCount));
}


const mstEdges = kruskal(points, weightedEdges);
const finalLayoutEdges = addBackEdges(weightedEdges, mstEdges, 0.15);

console.log(`MST Edges: ${mstEdges.length}`);
console.log(`Final Edges (with loops): ${finalLayoutEdges.length}`);

//Draw the MST
function drawMST(canvas, edges, points) {
    let ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width / 16, canvas.height / 16);
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = "red";

    for (let edge of edges) {
        const p1 = points[edge.a];
        const p2 = points[edge.b];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
    ctx.restore();
}

//drawMST(canvas, finalLayoutEdges, points);

//TRY ADDING THE LAYOUTS FOR ROOMS FOR A DUNGEON FLOOR

function generateRooms(points) {
    return points.map(p => {
        const width = Math.random() * 2 + 1;
        const height = Math.random() * 2 + 1;

        return {
            x: p.x - width / 2,
            y: p.y - height / 2,
            width,
            height,
            center: p
        };
    });
}

function drawCorridor(p1, p2) {
    ctx.beginPath();

    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p1.y);
    ctx.lineTo(p2.x, p2.y);

    ctx.stroke();
}

function drawCorridors(canvas, edges, rooms) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width / WIDTH, canvas.height / HEIGHT);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 0.05;

    for(let edge of edges) {
        const r1 = rooms[edge.a];
        const r2 = rooms[edge.b];

        drawCorridor(r1.center, r2.center);
    }
    ctx.restore();
}

const rooms = generateRooms(points);

//Draw the rooms
function drawRooms(canvas, rooms) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width / 16, canvas.height / 16);

    ctx.fillStyle = randomHSL();
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 0.05;

    for(let room of rooms) {
        ctx.beginPath();
        ctx.rect(room.x, room.y, room.width, room.height);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

drawCorridors(canvas, finalLayoutEdges, rooms);
drawRooms(canvas, rooms);


//SNAPPING

function createGrid(width, height) {
    const grid = [];
    for (let y = 0; y < height; y++){
        grid[y] = [];
        for (let x = 0; x < width; x++) {
            grid[y][x] = 0;
        }
    }
    return grid;
}

const GRID_SIZE = 64;
const grid = createGrid(GRID_SIZE, GRID_SIZE);

function toGrid(value) {
    return Math.floor(value * (GRID_SIZE / 16));
}

function carveRooms(grid, rooms) {
    for (let room of rooms) {
        const x1 = toGrid(room.x);
        const y1 = toGrid(room.y);
        const x2 = toGrid(room.x + room.width);
        const y2 = toGrid(room.y + room.height);

        for (let y = y1; y <= y2; y++){
            for (let x = x1; x <= x2; x++){
                if (grid[y] && grid[y][x] !== undefined) {
                    grid[y][x] = 1;
                }
            }//End of innermost loop
        }//End of first inner loop

    }
}

function carveCorridor(grid, p1, p2){
    let x1 = toGrid(p1.x);
    let y1 = toGrid(p1.y);
    let x2 = toGrid(p2.x);
    let y2 = toGrid(p2.y);

    if (Math.random() < 0.5) {
        //horizontal to vertical
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            grid[y1][x] = 1;
        }
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            grid[y][x2] = 1;
        }
    } else {
        //vertical to horizontal
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            grid[y][x1] = 1;
        }
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            grid[y2][x] = 1;
        }
    }
}

function carveCorridors(grid, edges, rooms) {
    for (let edge of edges) {
        const r1 = rooms[edge.a];
        const r2 = rooms[edge.b];

        carveCorridor(grid, r1.center, r2.center);
    }
}

function drawGrid(canvas, grid) {
    const ctx = canvas.getContext('2d');

    const tileSize = canvas.width / grid.length;

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {

            if (grid[y][x] === 1) {
                ctx.fillStyle = "red"; 
            } else {
                ctx.fillStyle = "black"; 
            }

            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
    }
}

/* carveRooms(grid, rooms);
carveCorridors(grid, finalLayoutEdges, rooms);
drawGrid(canvas, grid); */
