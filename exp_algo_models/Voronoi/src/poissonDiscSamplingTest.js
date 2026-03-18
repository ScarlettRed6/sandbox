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
const points = poissonDiskSampling(16, 16, 2, 10);
/* const points = randomPoints(10, 10, 3); */
const delaunay = Delaunator.from(points, loc => loc.x, loc => loc.y);

ctx.save();
ctx.scale(canvas.width / 16, canvas.height / 16);
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
    ctx.scale(canvas.width / 14, canvas.height / 14);
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

drawCellBoundaries(canvas, map);

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


const mstEdges = kruskal(points, weightedEdges, 0.1);
const finalLayoutEdges = addBackEdges(weightedEdges, mstEdges);

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

drawMST(canvas, finalLayoutEdges, points);
