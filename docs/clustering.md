# Location Clustering

The location clustering feature groups nearby GPS points to reduce visual clutter on maps while preserving the essential shape and coverage of your location data.

## Overview

When you have many location points in a small area (like walking around a building or staying in one place for a while), displaying all points can make maps difficult to read. The clustering algorithm solves this by:

1. Grouping nearby points within a specified distance
2. Selecting representative points for each cluster
3. Reducing the total number of points while maintaining spatial accuracy

## Algorithm Details

### Clustering Process

The clustering algorithm uses a **streaming approach** that processes locations in chronological order:

1. **Start with an empty cluster**
2. **For each location point:**
   - Calculate distance from point to current cluster centroid
   - If distance < `maxDist`: add to current cluster
   - If distance ≥ `maxDist`: check future points with sliding window
   - If enough future points are also far away: finalize current cluster and start new one
   - Otherwise: add the point to current cluster anyway

3. **Finalize the last cluster**

### Distance Calculation

Uses the **Haversine formula** for great-circle distance:

```typescript
function crowFlyDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}
```

### Representative Selection

For each cluster, the algorithm selects the point **closest to the cluster centroid**:

1. Calculate centroid coordinates (average lat/lng of all points in cluster)
2. Find the actual point with minimum distance to centroid
3. Use this point as the cluster representative

This ensures representatives are actual recorded locations, not interpolated points.

### Sliding Window Logic

To prevent premature cluster splitting, the algorithm uses a **sliding window** approach:

- **Window Size**: 5 points (configurable)
- **Split Threshold**: 20% (configurable)

When a point is far from the current cluster:
1. Look ahead at the next 5 points
2. Count how many of these are also far from the cluster
3. If ≥20% are far away: finalize the cluster
4. Otherwise: add the point to the current cluster

This prevents single outlier points from breaking up logical clusters.

## Configuration Parameters

### `maxDist` (Clustering Distance)

- **Default**: 20 meters
- **Range**: 0+ meters
- **Special value**: 0 = no clustering (return all points)

**Choosing the right distance:**
- **0-10m**: Very tight clustering, good for stationary periods
- **10-50m**: Good for walking around buildings, neighborhoods
- **50-200m**: Good for city-level clustering
- **200m+**: Good for regional clustering

### `windowSize` (Sliding Window)

- **Default**: 5 points
- **Purpose**: Prevents over-clustering from single outliers
- **Higher values**: More resistant to outliers, may keep some clusters too long
- **Lower values**: More responsive to movement, may create more clusters

### `splitThreshold` (Split Decision)

- **Default**: 0.2 (20%)
- **Purpose**: Fraction of window points that must be far to trigger split
- **Higher values**: More resistant to splitting, larger clusters
- **Lower values**: More likely to split, smaller clusters

## Usage Examples

### API Usage

```bash
# No clustering (all points)
curl "https://your-worker.workers.dev/locations?clusterMaxDist=0"

# Light clustering (20m)
curl "https://your-worker.workers.dev/locations?clusterMaxDist=20"

# Heavy clustering (100m)
curl "https://your-worker.workers.dev/locations?clusterMaxDist=100"
```

### Web Interface

The web interface provides a clustering distance slider:
- Adjust the "Cluster (m)" field
- Click "Load" to apply clustering
- Lower values show more points, higher values show fewer

## Performance Characteristics

### Time Complexity
- **O(n)** where n = number of location points
- Processes each point exactly once
- No expensive clustering algorithms (k-means, hierarchical, etc.)

### Space Complexity
- **O(w)** where w = window size (default 5)
- Constant memory usage regardless of dataset size
- Suitable for large location datasets

### Accuracy Trade-offs
- **Lower clustering distance**: Higher accuracy, more points
- **Higher clustering distance**: Lower accuracy, fewer points
- **Representative selection**: Maintains actual GPS coordinates

## Clustering Behavior Examples

### Stationary Period (Home/Office)
```
Input: 100 points within 10m radius over 8 hours
Output with 20m clustering: 1-3 representative points
```

### Walking Route
```
Input: 500 points along 2km walking path
Output with 20m clustering: 50-100 points showing route shape
```

### Road Trip
```
Input: 1000 points across 500km drive
Output with 100m clustering: 200-400 points showing major stops
```

## Implementation Notes

### Database Efficiency
- Clustering happens **after** database query
- Database returns all matching points
- Clustering reduces points sent to client
- Consider adding spatial indexing for large datasets

### Chronological Processing
- Points are processed in **reverse chronological order** (newest first)
- This matches the typical database query order (`ORDER BY id DESC`)
- Results are reversed again before clustering for correct temporal sequence

### Precision Considerations
- Uses double-precision floating point for coordinates
- Haversine formula accurate for distances up to ~1000km
- Sufficient precision for typical location clustering use cases

## Future Enhancements

Potential improvements to consider:

1. **Adaptive Clustering**: Adjust distance based on movement speed
2. **Temporal Clustering**: Consider time gaps between points
3. **Zoom-level Clustering**: Different clustering for different map zoom levels
4. **Spatial Indexing**: Database-level spatial queries for better performance
5. **Multiple Representatives**: Return multiple points per cluster for complex shapes