const GRIDSIZE = 16;
const JITTER = 0.5;
const WAVELENGTH = 0.5;

//Generate random hue , saturation and lightness
//Set minimum to ignore white or washed out colors
function randomHSL() {
    const HUE = Math.floor(Math.random() * 361);
    const SATURATION = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
    const LIGHTNESS = Math.floor(Math.random() * (80 - 20  + 1)) + 20;

    return `hsl(${HUE}, ${SATURATION}%, ${LIGHTNESS}%)`;
}

function generateJitteredGridPoints(gridsize, jitter) {
    let points = [];
    //The loop is for generating a tile for each location in the map
    for (let x = 0; x <= gridsize; x++){
        for (let y = 0; y <= gridsize; y++){
            points.push({x: x + jitter * (Math.random() - Math.random()),
                y: y + jitter * (Math.random() - Math.random())
            });
        }//End of inner loop
    }//End of outer loop
    console.log(`Points array length: ${points.length}`);
    console.log(points);
    return points;
}//End of jitter generator when drawing points

function drawPoints(canvas, gridsize, points, radius=0.1){
    let ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width / gridsize, canvas.height / gridsize);
    ctx.fillStyle = randomHSL();
    for (let {x, y} of points){
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2*Math.PI);
        ctx.fill();
    }
    ctx.restore();
}//End of points generation

//Generate the points
let points = generateJitteredGridPoints(GRIDSIZE, JITTER);
let delaunay = Delaunator.from(points, loc => loc.x, loc => loc.y);

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

let map = {
    points,
    gridsize: GRIDSIZE,
    numRegions: points.length,
    numTriangles: delaunay.halfedges.length / 3,
    numEdges: delaunay.halfedges.length,
    halfedges: delaunay.halfedges,
    triangles: delaunay.triangles,
    centers: calculateCentroids(points, delaunay)
};
console.log(`CENTERS ${map.centers}`);
//Helper runctions
function triangleOfEdge(e) {
    return Math.floor(e / 3);
}

/* function nextHalfEdge(e) {
    return (e % 3 === 2) ? e - 2 : e + 1;
}

function prevHalfEdge(e) {
    return (e % 3 === 0) ? e + 2 : e - 1;
}

function edgesOfTriangle(t) {
    return [ 3 * t, 3 * t + 1, 3 * t + 2];
} */

function drawCellBoundaries(canvas, map) {
    let { points, centers, halfedges, triangles, numEdges } = map;
    let ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width / map.gridsize, canvas.height / map.gridsize);
    ctx.lineWidth = 0.02;
    ctx.strokeStyle = "black";
    for (let e = 0; e < numEdges; e++){
        if (e < halfedges[e]){
            const p = centers[triangleOfEdge(e)];
            const q = centers[triangleOfEdge(halfedges[e])];
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
        }
    }

    ctx.restore();
}//End of drawCellBoundaries function

//Adding noise, elevations
/* function assignElevation(map) {
    const noise = new SimplexNoise();
    let { points, numRegions } = map;
    let elevation = [];
    for (let r = 0; r < numRegions; r++){
        let nx = points[r].x / map.gridsize - 1/2,
            ny = points[r].y / map.gridsize - 1/2;
        elevation[r] = (1/2 
            + noise.noise2D(nx / WAVELENGTH, ny / WAVELENGTH) / 2
            + noise.noise2D(2 * nx / WAVELENGTH, 2 * ny / WAVELENGTH));

        let d = 2 * Math.max(Math.abs(nx), Math.abs(ny));
        elevation[r] = (1 + elevation[r] - d) / 2;
    }//End of loop
    return elevation;
}//End of assignElevation function

map.elevation = assignElevation(map);

//Drawing the regions
function edgesAroundPoint(halfedges, start) {
    const result = [];
    let incoming = start;
    do {
        result.push(incoming);
        const outgoing = nextHalfEdge(incoming);
        incoming = halfedges[outgoing];
    } while (incoming != -1 && incoming != start);
    return result;
}

function drawCellColors(canvas, map, colorFn) {
    let ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width / map.gridsize, canvas.height / map.gridsize);
    let seen = new Set();
    let { triangles, numEdges, centers } = map;
    for (let e = 0; e < numEdges; e++){
        const r = triangles[nextHalfEdge(e)];
        if (!seen.has(r)){
            seen.add(r);
            let vertices = edgesAroundPoint(map.halfedges, e).map(e => centers[triangleOfEdge(e)]);
            ctx.fillStyle = colorFn(r);
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++){
                ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.fill();
        }//End of if statement
    }//End of outerloop
    ctx.restore();
} */


//Trying MST with kruskal's algorithm (FAILED)
function kruskalsMST(vertices, map) {
    let edges = map.halfedges;
    edges.sort((a, b) => a[2] - b[2]);
    //console.log(edges);
    
    const dsu = new DSU(map.numRegions);
    let cost = 0;
    let count = 0;
    for (const [x,y,w] of edges) {
        if (dsu.find(x) !== dsu.find(y)) {
            dsu.unite(x,y);
            cost += w;
            if(++count === vertices - 1) break;
        }
    }
    return cost;

}

class DSU {
    constructor(n){
        this.parent = Array.from({ length: n }, (_, i) => i);
        this.rank = Array(n).fill(1);
    }

    find(i){
        if (this.parent[i] !== i){
            this.parent[i] = this.find(this.parent[i]);
        }
        return this.parent[i];
    }

    unite(x, y) {
        const s1 = this.find(x);
        const s2 = this.find(y);
        if (s1 !== s2) {
            if (this.rank[s1] < this.rank[s2]) this.parent[s1] = s2;
                else if (this.rank[s1] > this.rank[s2]) this.parent[s2] = s1;
                else {
                    this.parent[s2] = s1;
                    this.rank[s1]++;
                }
        }
    }

}


drawPoints(document.getElementById("map"), GRIDSIZE, points);
drawCellBoundaries(document.getElementById("map"), map);
//drawCellColors(document.getElementById("map"), map, r => map.elevation[r] < 0.5? "hsl(240, 30%, 50%)" : "hsl(90, 20%, 50%)");
