using UnityEngine;
using System.Collections.Generic;

[System.Serializable]
public class DungeonEdge
{
    public int nodeA;
    public int nodeB;
    public float weight;

    public DungeonEdge(int a, int b, float w)
    {
        nodeA = a;
        nodeB = b;
        weight = w;
    }
}

