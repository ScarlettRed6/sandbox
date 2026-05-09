public class DisjointSet
{
    private int[] parent;
    public DisjointSet(int size)
    {
        parent = new int[size];
        for (int i = 0; i < size; i++) parent[i] = i;
    }

    public int Find(int i)
    {
        if (parent[i] == i) return i;
        return parent[i] = Find(parent[i]);
    }

    public bool Union(int i, int j)
    {
        int rootI = Find(i);
        int rootJ = Find(j);
        if (rootI != rootJ)
        {
            parent[rootI] = rootJ;
            return true;
        }
        return false;
    }
}