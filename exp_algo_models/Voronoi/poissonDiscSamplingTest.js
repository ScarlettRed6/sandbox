
let numPoints = 0;
const points = poissonDiskSampling(16, 16, 1);

let canvas = document.getElementById("map");
let ctx = canvas.getContext('2d');

function randomHSL() {
    const HUE = Math.floor(Math.random() * 361);
    const SATURATION = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
    const LIGHTNESS = Math.floor(Math.random() * (80 - 20  + 1)) + 20;

    return `hsl(${HUE}, ${SATURATION}%, ${LIGHTNESS}%)`;
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

        const index = Math.floor(Math.random() * active.length);
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

    return points;
}

ctx.save();
ctx.scale(canvas.width / 16, canvas.height / 16);
ctx.fillStyle = randomHSL();
for (let {x, y} of points) {
    ctx.beginPath();
    ctx.arc(x, y, 0.1, 0, 2 * Math.PI);
    ctx.fill();
}
ctx.restore();
console.log(`NUMBER OF POINTS ${numPoints}`);
