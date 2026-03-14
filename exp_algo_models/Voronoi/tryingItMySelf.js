const GRIDSIZE = 16;
const JITTER = 0.5;
const RADIUS = 0.1;
const points = [];

let canvas = document.getElementById("map");
let ctx = canvas.getContext('2d');
let delaunay = Delaunator.from(points, loc => loc.x, loc => loc.y);

//Generate random hue , saturation and lightness
//Set minimum to ignore white or washed out colors
function randomHSL() {
    const HUE = Math.floor(Math.random() * 361);
    const SATURATION = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
    const LIGHTNESS = Math.floor(Math.random() * (80 - 20  + 1)) + 20;

    return `hsl(${HUE}, ${SATURATION}%, ${LIGHTNESS}%)`;
}

//Generating the jitter 
for (let x = 0; x <= GRIDSIZE; x++) {
    for (let y = 0; y <= GRIDSIZE; y++) {
        points.push({x, y});
    }//End of inner loop
}//End of for loop

//Generating the points with JITTER
ctx.save();
ctx.scale(canvas.width / GRIDSIZE, canvas.height / GRIDSIZE);
ctx.fillStyle = randomHSL();
for (let {x, y} of points) {
    ctx.beginPath();
    ctx.arc(x, y, RADIUS, 0, 2*Math.PI);
    ctx.fill();
}
ctx.restore();

//HERE STARTS THE GENERATION OF VORONOI CELLS

//calculate centroids
const numTriangles = delaunay.halfedges.length / 3;
let centroids = [];
for (let t = 0; t < numTriangles; t++) {
    let sumOfX = 0, sumOfY = 0;
    for (let i = 0; i < 3; i++) {
        let s = 3*t + i;
        let p = points[delaunay.triangles[s]];
        sumOfX += p.x;
        sumOfY += p.y;
    }
    centroids[t] = {x: sumOfX / 3, y: sumOfY / 3};
}
let centers = centroids;

//generate the cell boundaries
let halfedges = delaunay.halfedges;
let numEdges = delaunay.halfedges.length;
let ctxCells = canvas.getContext('2d');

function triangleOfEdge(e) {
    return Math.floor(e / 3 );
}

ctxCells.save();
ctxCells.scale(canvas.width / GRIDSIZE, canvas.height / GRIDSIZE);
ctxCells.lineWidth = 0.02;
ctxCells.strokeStyle = "black";
for (let e = 0; e < numEdges; e++) {
    if (e < halfedges[e]) {
        const p = centers[triangleOfEdge(e)];
        const q = centers[triangleOfEdge(halfedges[e])];
        ctxCells.beginPath();
        ctxCells.moveTo(p.x, p.y);
        ctxCells.lineTo(q.x, q.y);
        ctxCells.stroke();
    }
}
ctxCells.restore();

console.log(`CENTROIDS ${centroids}`);
console.log(`POINTS ${points}`);