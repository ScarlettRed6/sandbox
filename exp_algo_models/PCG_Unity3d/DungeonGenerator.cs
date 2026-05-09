using UnityEngine;
using System.Collections.Generic;
using System.Linq;
using DelaunatorSharp;

public class DungeonGenerator : MonoBehaviour
{
    [Header("Prefabs")]
    public GameObject floorPrefab;
    public GameObject corridorPrefab;
    public GameObject wallPrefab;
    public GameObject chestPrefab;
    public GameObject bonfirePrefab;
    public GameObject bossPrefab;
    public GameObject enemeyPrefab;

    [Header("Grid Settings")]
    public int gridSize = 88;
    public int padding = 10;
    public float worldScale = 1f;

    [Header("Room Size")]
    public int RoomWidthMin = 6;
    public int RoomWidthMax = 16;
    public int RoomHeightMin = 6;
    public int RoomHeightMax = 16;

    [Header("Poisson Settings")]
    public float radius = 15f;
    public int k = 30;

    [Header("Benchmark Toggle")]
    public bool useAStar = true;

    private int[,] grid;
    private List<Vector2> roomCenters;
    private List<DungeonEdge> mstEdges;
    private int roomsNum = 0;

    void Start()
    {
        Generate();
    }

    [ContextMenu("Generate")]
    public void Generate()
    {
        System.Diagnostics.Stopwatch dungeonStopwatch = new System.Diagnostics.Stopwatch();
        dungeonStopwatch.Start();
        //Clear old dungeon when regenerating a new one
        foreach (Transform child in transform) Destroy(child.gameObject);

        grid = new int[gridSize, gridSize];
        
        //Poisson Disk Sampling
        roomCenters = RunPoissonSampling();

        //Delaunator triangulation
        IPoint[] points = roomCenters.Select(p => (IPoint)new Point(p.x, p.y)).ToArray();
        var delaunay = new Delaunator(points);
        List<DungeonEdge> allEdges = ExtractEdges(delaunay);

        //Kruskal's algorithm for MST
        mstEdges = RunKruskal(roomCenters.Count, allEdges);

        //Carving rooms
        CarveRooms();
        CarveCorridors();

        //Spawning the floor/dungeon layout
        SpawnDungeon();

        //Room classifications for spawning specific category of game objects
        ClassifyRooms();

        //Populate rooms after classfication
        PopulateDungeon();

        dungeonStopwatch.Stop();
        Debug.Log($"Dungeon Generated in: {dungeonStopwatch.Elapsed.TotalMilliseconds} ms");
    }

    void CarveRooms()
    {
        foreach (var center in roomCenters)
        {
            //Random room size 
            int rw = Random.Range(RoomWidthMin, RoomWidthMax);
            int rh = Random.Range(RoomHeightMin, RoomHeightMax);

            int startX = Mathf.RoundToInt(center.x - rw / 2f);
            int startZ = Mathf.RoundToInt(center.y - rh / 2f);

            for (int x = startX; x < startX + rw; x++)
            {
                for (int z = startZ; z < startZ + rh; z++)
                {
                    if (IsInBounds(x, z)) grid[x, z] = 1;
                }
            }
        }
    }//End of CarveRooms method

    void CarveCorridors()
    {
        System.Diagnostics.Stopwatch corridorStopwatch = new System.Diagnostics.Stopwatch();
        corridorStopwatch.Start();

        foreach (var edge in mstEdges)
        {
            Vector2Int p1 = Vector2Int.RoundToInt(roomCenters[edge.nodeA]);
            Vector2Int p2 = Vector2Int.RoundToInt(roomCenters[edge.nodeB]);

            //Pick which algorithm to use for generating corridors
            if (useAStar)
            {
                //SMART PATHFINDING
                List<Vector2Int> path = FindAStarPath(p1, p2);
                foreach (var cell in path)
                {
                    CarveThickPoint(cell.x, cell.y);
                }
            }
            else
            {
                //L-SHAPE (Deterministic)
                int x = p1.x;
                int z = p1.y;
                while (x != p2.x)
                {
                    CarveThickPoint(x, z);
                    x += (p2.x > x) ? 1 : -1;
                }
                while (z != p2.y)
                {
                    CarveThickPoint(x, z);
                    z += (p2.y > z) ? 1 : -1;
                }
            }
        }//End of foreach loop

        corridorStopwatch.Stop();
        if(useAStar)
            Debug.Log($"(A* Search) Corridors generated in: {corridorStopwatch.Elapsed.TotalMilliseconds} ms");
        else
            Debug.Log($"(L-Shape Deterministic) Corridors generated in: {corridorStopwatch.Elapsed.TotalMilliseconds} ms");

    }//End of CarveCorridors method

    // Helper to make corridors 2 or 3 tiles wide
    void CarveThickPoint(int x, int z)
    {
        for (int ix = -1; ix <= 1; ix++)
        {
            for (int iz = -1; iz <= 1; iz++)
            {
                int nx = x + ix;
                int nz = z + iz;
                if (IsInBounds(nx, nz) && grid[nx, nz] == 0) 
                    grid[nx, nz] = 2;
            }
        }
    }//End of CarveThickPoint method

    void SpawnDungeon()
    {
        for (int x = 0; x < gridSize; x++)
        {
            for (int z = 0; z < gridSize; z++)
            {
                Vector3 pos = new Vector3(x * worldScale, 0, z * worldScale);
                
                if (grid[x, z] > 0) //If it's a Room (1) or Corridor (2)
                {
                    Instantiate(floorPrefab, pos, Quaternion.identity, transform);
                    
                    //Only spawn walls AROUND the room not the whole floor
                    SpawnWallsAround(x, z);
                }
            }
        }
    }//End of SpawnDungeon method

    void SpawnWallsAround(int x, int z)
    {
        //Check 4 directions (North, South, East, West)
        int[] dx = {0, 0, 1, -1};
        int[] dz = {1, -1, 0, 0};

        for (int i = 0; i < 4; i++)
        {
            int nx = x + dx[i];
            int nz = z + dz[i];

            if (IsInBounds(nx, nz) && grid[nx, nz] == 0)
            {
                Vector3 wallPos = new Vector3(nx * worldScale, 1.0f, nz * worldScale);

                Vector3 directionToFace = new Vector3(-dx[i], 0, -dz[i]);
                Quaternion wallRotation = Quaternion.LookRotation(directionToFace);

                //Check if a wall already exists there to prevent double-spawning
                Instantiate(wallPrefab, wallPos, wallRotation, transform);
            }
        }
    }//End of SpawnWallsAround method

    bool IsInBounds(int x, int z) => x >= 0 && x < gridSize && z >= 0 && z < gridSize;

    //POISSON DISK SAMPLING WITH BRIDSON'S ALGORITHM IMPLEMENTATION
    List<Vector2> RunPoissonSampling()
    {
        System.Diagnostics.Stopwatch pdsStopwatch = new System.Diagnostics.Stopwatch();
        pdsStopwatch.Start();

        float cellSize = radius / Mathf.Sqrt(2);
        int[,] samplingGrid = new int[Mathf.CeilToInt(gridSize / cellSize), Mathf.CeilToInt(gridSize / cellSize)];
        for (int i = 0; i < samplingGrid.GetLength(0); i++)
            for (int j = 0; j < samplingGrid.GetLength(1); j++) samplingGrid[i, j] = -1;

        List<Vector2> points = new List<Vector2>();
        List<Vector2> active = new List<Vector2>();

        Vector2 first = new Vector2(Random.Range(0, gridSize - padding), Random.Range(0, gridSize - padding));
        active.Add(first);
        points.Add(first);
        samplingGrid[(int)(first.x / cellSize), (int)(first.y / cellSize)] = 0;

        while (active.Count > 0)
        {
            int idx = Random.Range(0, active.Count);
            Vector2 point = active[idx];
            bool found = false;

            for (int i = 0; i < k; i++)
            {
                float angle = Random.value * Mathf.PI * 2;
                float mag = Random.Range(radius, 2 * radius);
                Vector2 candidate = point + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * mag;

                if (candidate.x >= padding && candidate.x < gridSize - padding && 
                    candidate.y >= padding && candidate.y < gridSize - padding)
                {
                    int gx = (int)(candidate.x / cellSize);
                    int gy = (int)(candidate.y / cellSize);
                    bool farEnough = true;

                    for (int x = Mathf.Max(0, gx - 2); x <= Mathf.Min(samplingGrid.GetLength(0) - 1, gx + 2); x++)
                        for (int y = Mathf.Max(0, gy - 2); y <= Mathf.Min(samplingGrid.GetLength(1) - 1, gy + 2); y++)
                            if (samplingGrid[x, y] != -1 && Vector2.Distance(candidate, points[samplingGrid[x, y]]) < radius)
                                farEnough = false;

                    if (farEnough)
                    {
                        samplingGrid[gx, gy] = points.Count;
                        points.Add(candidate);
                        active.Add(candidate);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) active.RemoveAt(idx);
        }//End of while loop

        pdsStopwatch.Stop();
        Debug.Log($"(Poisson Disk Sampling) Room Cells (Points) generated in: {pdsStopwatch.Elapsed.TotalMilliseconds} ms");

        return points;
    }

    //DELAUNAY EDGE EXTRACTION
    List<DungeonEdge> ExtractEdges(Delaunator delaunay)
    {
        List<DungeonEdge> edges = new List<DungeonEdge>();
        for (int i = 0; i < delaunay.Triangles.Length; i++)
        {
            if (i > delaunay.Halfedges[i])
            {
                int p = delaunay.Triangles[i];
                int q = delaunay.Triangles[i % 3 == 2 ? i - 2 : i + 1];
                edges.Add(new DungeonEdge(p, q, Vector2.Distance(roomCenters[p], roomCenters[q])));
            }
        }
        return edges;
    }

    //KRUSKAL'S ALGORITHM FOR MST 
    List<DungeonEdge> RunKruskal(int nodeCount, List<DungeonEdge> allEdges)
    {
        System.Diagnostics.Stopwatch kruskalStopwatch = new System.Diagnostics.Stopwatch();
        kruskalStopwatch.Start();

        List<DungeonEdge> mst = new List<DungeonEdge>();
        var sortedEdges = allEdges.OrderBy(e => e.weight).ToList();
        DisjointSet dsu = new DisjointSet(nodeCount);

        foreach (var edge in sortedEdges)
        {
            if (dsu.Union(edge.nodeA, edge.nodeB))
            {
                mst.Add(edge);
            }
        }
        
        //Add some loops back in 
        float loopChance = 0.15f;
        foreach (var edge in sortedEdges)
        {
            if (!mst.Contains(edge) && Random.value < loopChance)
            {
                mst.Add(edge);
            }
        }

        kruskalStopwatch.Stop();
        Debug.Log($"(Kruskal's MST) Conneteced all points using the shortest possible edges in: {kruskalStopwatch.Elapsed.TotalMilliseconds} ms");

        return mst;
    }

    private List<RoomData> roomDataList;

    void ClassifyRooms() {
        roomDataList = new List<RoomData>();
        for (int i = 0; i < roomCenters.Count; i++) {
            roomDataList.Add(new RoomData { id = i, center = roomCenters[i] });
        }

        foreach (var edge in mstEdges) {
            roomDataList[edge.nodeA].neighbors.Add(edge.nodeB);
            roomDataList[edge.nodeB].neighbors.Add(edge.nodeA);
        }

        //Implementation of BFS algorithm
        Queue<int> queue = new Queue<int>();
        Dictionary<int, int> distances = new Dictionary<int, int>();

        int startId = 0;
        queue.Enqueue(startId);
        distances[startId] = 0;

        int furthestRoomId = startId;
        int maxDistance = 0;

        while (queue.Count > 0) {
            int current = queue.Dequeue();

            foreach (int neighbor in roomDataList[current].neighbors) {
                if (!distances.ContainsKey(neighbor)) {
                    distances[neighbor] = distances[current] + 1;
                    queue.Enqueue(neighbor);

                    if (distances[neighbor] > maxDistance) {
                        maxDistance = distances[neighbor];
                        furthestRoomId = neighbor;
                    }
                }
            }
        }

        //Label based on BFS results
        roomDataList[startId].type = "Start";
        roomDataList[furthestRoomId].type = "Boss";

        foreach (var room in roomDataList) {
            if (room.id != startId && room.id != furthestRoomId) {
                // If it only has 1 neighbor, it's a dead end
                if (room.neighbors.Count == 1) room.type = "Treasure";
                else room.type = "Combat";
            }
        }
    }//End of ClassifyRooms method

    void PopulateDungeon() {
        Vector3 GetWorldCenter(RoomData room) => new Vector3(room.center.x * worldScale, 0.5f, room.center.y * worldScale);
        foreach (var room in roomDataList) {
            switch(room.type) {
                case "Start":
                    Instantiate(bonfirePrefab, GetWorldCenter(room), Quaternion.identity, transform);
                    break;
                case "Boss":
                    Instantiate(bossPrefab, GetWorldCenter(room), Quaternion.identity, transform);
                    break;
                case "Treasure":
                    Instantiate(chestPrefab, GetWorldCenter(room), Quaternion.identity, transform);
                    break;
                default: // Combat rooms
                    Instantiate(enemeyPrefab, GetWorldCenter(room), Quaternion.identity, transform);
                    break;
            }
        }//End of foreach
    }

    List<Vector2Int> FindAStarPath(Vector2Int start, Vector2Int end) {
        List<PathNode> openList = new List<PathNode>();
        HashSet<Vector2Int> closedList = new HashSet<Vector2Int>();
        
        PathNode startNode = new PathNode(start);
        openList.Add(startNode);
            while (openList.Count > 0) {
                PathNode current = openList.OrderBy(n => n.fCost).First();
                if (current.pos == end) return RetracePath(current);

                openList.Remove(current);
                closedList.Add(current.pos);

                foreach (Vector2Int neighborPos in GetNeighbors(current.pos)) {
                    if (closedList.Contains(neighborPos)) continue;

                    //VAZGRIZ COST LOGIC:
                    int moveCost = 10;

                    //Avoid Rooms
                    if (grid[neighborPos.x, neighborPos.y] == 1) moveCost = 100;

                    //Prefer Hallways
                    if (grid[neighborPos.x, neighborPos.y] == 2) moveCost = 1;

                    int newGCost = current.gCost + moveCost;
                    PathNode neighbor = openList.Find(n => n.pos == neighborPos);

                    if (neighbor == null || newGCost < neighbor.gCost) {
                        if (neighbor == null) {
                            neighbor = new PathNode(neighborPos);
                            openList.Add(neighbor);
                        }
                        neighbor.gCost = newGCost;
                        neighbor.hCost = Mathf.Abs(neighborPos.x - end.x) + Mathf.Abs(neighborPos.y - end.y);
                        neighbor.parent = current;
                    }
                }
            }
        
        //No path found
        return new List<Vector2Int>();
    }

    List<Vector2Int> RetracePath(PathNode endNode) {
        List<Vector2Int> path = new List<Vector2Int>();
        PathNode curr = endNode;
        while (curr != null) {
            path.Add(curr.pos);
            curr = curr.parent;
        }
        return path;
    }

    IEnumerable<Vector2Int> GetNeighbors(Vector2Int p) {
        if (IsInBounds(p.x + 1, p.y)) yield return new Vector2Int(p.x + 1, p.y);
        if (IsInBounds(p.x - 1, p.y)) yield return new Vector2Int(p.x - 1, p.y);
        if (IsInBounds(p.x, p.y + 1)) yield return new Vector2Int(p.x, p.y + 1);
        if (IsInBounds(p.x, p.y - 1)) yield return new Vector2Int(p.x, p.y - 1);
    }

    bool HasNeighboringFloor(int x, int z)
    {
        for (int ix = -1; ix <= 1; ix++)
        {
            for (int iz = -1; iz <= 1; iz++)
            {
                if (ix == 0 && iz == 0) continue;
                int nx = x + ix;
                int nz = z + iz;
                if (IsInBounds(nx, nz) && grid[nx, nz] > 0) return true;
            }
        }
        return false;
    }

}

public class RoomData {
    public int id;
    public Vector2 center;
    public List<int> neighbors = new List<int>();
    public string type = "Combat"; // Default
}

public class PathNode {
    public Vector2Int pos;
    public int gCost; // Distance from start
    public int hCost; // Distance to end (Heuristic)
    public int fCost => gCost + hCost;
    public PathNode parent;

    public PathNode(Vector2Int p) { pos = p; }
}

