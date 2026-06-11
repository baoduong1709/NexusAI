const fs = require('fs');
const path = require('path');

function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("Usage: node ua-tour-analyze.js <input-json-path> <output-json-path>");
        process.exit(1);
    }

    const inputPath = path.resolve(args[0]);
    const outputPath = path.resolve(args[1]);

    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const nodes = inputData.nodes || [];
    const edges = inputData.edges || [];
    const layers = inputData.layers || [];

    console.log(`Loaded ${nodes.length} nodes, ${edges.length} edges, and ${layers.length} layers.`);

    // Build adjacency list and in/out degrees
    const adj = {};
    const revAdj = {};
    const inDegree = {};
    const outDegree = {};

    nodes.forEach(node => {
        adj[node.id] = [];
        revAdj[node.id] = [];
        inDegree[node.id] = 0;
        outDegree[node.id] = 0;
    });

    edges.forEach(edge => {
        const u = edge.source;
        const v = edge.target;
        
        // Edge might refer to non-existent nodes, let's handle them gracefully
        if (adj[u] && adj[v]) {
            adj[u].push(v);
            revAdj[v].push(u);
            outDegree[u]++;
            inDegree[v]++;
        }
    });

    // 1. Entry point candidates: In-degree = 0 (or low in-degree)
    const entryPointCandidates = nodes
        .map(node => ({
            id: node.id,
            name: node.name,
            type: node.type,
            filePath: node.filePath,
            inDegree: inDegree[node.id] || 0,
            outDegree: outDegree[node.id] || 0
        }))
        .filter(n => n.inDegree === 0)
        .sort((a, b) => b.outDegree - a.outDegree); // prefer those that lead to more nodes

    // 2. Fan-In Ranking (most imported/used nodes)
    const fanInRanking = nodes
        .map(node => ({
            id: node.id,
            name: node.name,
            inDegree: inDegree[node.id] || 0
        }))
        .sort((a, b) => b.inDegree - a.inDegree);

    // 3. Fan-Out Ranking (nodes that import/depend on the most other nodes)
    const fanOutRanking = nodes
        .map(node => ({
            id: node.id,
            name: node.name,
            outDegree: outDegree[node.id] || 0
        }))
        .sort((a, b) => b.outDegree - a.outDegree);

    // 4. BFS Traversal starting from top entry point candidates
    const visited = new Set();
    const bfsTraversal = [];
    const queue = [];

    // Start BFS from all entryPointCandidates first
    entryPointCandidates.forEach(ep => {
        if (!visited.has(ep.id)) {
            visited.add(ep.id);
            queue.push(ep.id);
        }
    });

    // If queue is empty (e.g. cycle with no 0-indegree node), add node with lowest in-degree
    if (queue.length === 0 && nodes.length > 0) {
        const sortedByInDegree = [...nodes].sort((a, b) => (inDegree[a.id] || 0) - (inDegree[b.id] || 0));
        const startNode = sortedByInDegree[0].id;
        visited.add(startNode);
        queue.push(startNode);
    }

    while (queue.length > 0) {
        const curr = queue.shift();
        bfsTraversal.push(curr);

        const neighbors = adj[curr] || [];
        // sort neighbors by out-degree to explore more significant nodes first
        const sortedNeighbors = [...neighbors].sort((a, b) => (outDegree[b] || 0) - (outDegree[a] || 0));

        for (const neighbor of sortedNeighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    // Add any unvisited nodes (disconnected parts of the graph)
    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            visited.add(node.id);
            bfsTraversal.push(node.id);
        }
    });

    // 5. Weakly Connected Components (Clusters)
    const clusterVisited = new Set();
    const clusters = [];

    nodes.forEach(node => {
        if (!clusterVisited.has(node.id)) {
            const cluster = [];
            const q = [node.id];
            clusterVisited.add(node.id);

            while (q.length > 0) {
                const curr = q.shift();
                cluster.push(curr);

                // All neighbors (forward and backward directions)
                const neighbors = (adj[curr] || []).concat(revAdj[curr] || []);
                for (const neighbor of neighbors) {
                    if (!clusterVisited.has(neighbor)) {
                        clusterVisited.add(neighbor);
                        q.push(neighbor);
                    }
                }
            }
            clusters.push({
                id: `cluster-${clusters.length + 1}`,
                size: cluster.length,
                nodes: cluster
            });
        }
    });

    // Sort clusters by size descending
    clusters.sort((a, b) => b.size - a.size);

    const results = {
        entryPointCandidates,
        fanInRanking: fanInRanking.slice(0, 30),
        fanOutRanking: fanOutRanking.slice(0, 30),
        bfsTraversal: bfsTraversal.slice(0, 100),
        clusters: clusters.map(c => ({ id: c.id, size: c.size, sampleNodes: c.nodes.slice(0, 10) }))
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Analysis results successfully saved to: ${outputPath}`);
}

main();
