# Frontend Documentation

The web interface provides an interactive map for viewing your location history with various filtering and visualization options.

## Accessing the Interface

Navigate to your deployed Cloudflare Worker URL in a web browser:
```
https://your-worker.your-subdomain.workers.dev/
```

## Getting Started

### 1. Set Your API Token

When you first access the interface, you'll see a token prompt:

1. Enter your API token (must have `read` permission)
2. Click "Set Token"
3. The token is stored locally in your browser

**Token Storage:**
- Stored in `localStorage` for convenience
- Automatically restored when you return
- Only stored locally (never sent to servers other than your worker)

### 2. Initial Map Load

Once authenticated:
- Map loads with default world view
- Click "Load" to fetch your location data
- Points appear as colored markers on the map

## Interface Elements

### Map Controls

The map uses **Leaflet** with standard controls:
- **Zoom**: Mouse wheel or +/- buttons
- **Pan**: Click and drag
- **Reset View**: Double-click to fit all data

### Query Options Panel

Click the "Options" button to access filtering controls:

#### Time Filters
- **Start Time**: Earliest date/time to include
- **End Time**: Latest date/time to include
- **Format**: Browser's native date/time picker (YYYY-MM-DDTHH:MM)

#### Result Controls
- **Limit**: Maximum number of points to return
  - 0 = no limit (default: 1000 for performance)
  - Useful for large datasets
- **Cluster (m)**: Clustering distance in meters
  - 0 = no clustering (show all points)
  - 20 = default clustering (good for most uses)
  - Higher values = fewer points, more clustering

#### Geographic Filters
- **BBox (W,S,E,N)**: Bounding box coordinates
  - Format: "west,south,east,north"
  - Example: "-122.5,37.7,-122.3,37.8" (San Francisco area)
  - Leave empty for worldwide results

### Action Buttons

- **Load**: Apply current filters and fetch data
- **Refresh**: Reload with current settings
- **Set Token**: Change authentication token

## Using the Map

### Viewing Locations

- **Blue markers**: Individual location points
- **Click markers**: View popup with details
  - Point ID and coordinates
  - Timestamp (local time format)

### Filtering Your Data

#### By Time Range
1. Open Options panel
2. Set Start Time and/or End Time
3. Click "Load"

**Examples:**
- View last week: Set Start Time to 7 days ago
- View specific day: Set both Start and End to same date
- View recent data: Leave Start empty, set End to now

#### By Geographic Area
1. Open Options panel
2. Enter bounding box coordinates
3. Click "Load"

**Finding Coordinates:**
- Use online tools like [bboxfinder.com](http://bboxfinder.com/)
- Format: west,south,east,north (min_lng,min_lat,max_lng,max_lat)
- Or use browser developer tools to inspect network requests

#### By Density (Clustering)
1. Adjust "Cluster (m)" slider
2. Click "Load"
3. Compare results:
   - 0m: All points visible
   - 20m: Light clustering
   - 100m+: Heavy clustering

### Performance Tips

For large datasets:

1. **Use Time Filters**: Limit to recent data
2. **Set Result Limit**: Start with 1000 points or fewer
3. **Enable Clustering**: Use 20m+ for dense data
4. **Use Geographic Filters**: Focus on areas of interest

## Token Restrictions

### Time Range Restrictions

If your token has time range restrictions:
- Interface automatically enforces token limits
- You cannot query data outside allowed time range
- Time filters are constrained by token permissions

**Example:**
- Token allows 2023 data only
- Setting filters for 2024 returns no data
- Setting filters for 2022-2024 returns only 2023 data

### Permission Requirements

- **Read Permission**: Required to use the interface
- **Write Permission**: Not used by web interface
- **Create Token Permission**: Not used by web interface

## Browser Compatibility

### Supported Browsers
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Required Features
- Modern JavaScript (ES6+)
- LocalStorage API
- Fetch API
- Geolocation API (for future features)

### Mobile Support
- Responsive design works on mobile devices
- Touch-friendly map controls
- Mobile browsers supported

## Troubleshooting

### Common Issues

#### "Token required" message
- **Cause**: No token set or invalid token
- **Solution**: Click "Set Token" and enter valid API token

#### No data appears on map
- **Cause**: No location data, token restrictions, or filters too restrictive
- **Solutions**:
  - Check that locations exist in your database
  - Verify token has `read` permission
  - Remove time/geographic filters
  - Check token time range restrictions

#### Map doesn't load
- **Cause**: Network issues or JavaScript errors
- **Solutions**:
  - Check browser console for errors
  - Refresh the page
  - Try different browser
  - Check network connectivity

#### Performance issues with large datasets
- **Solutions**:
  - Increase clustering distance
  - Set result limit (e.g., 1000)
  - Use time filters to reduce data
  - Use geographic filters for specific areas

### Browser Developer Tools

For advanced troubleshooting:

1. **Console**: Check for JavaScript errors
2. **Network**: Monitor API requests/responses
3. **Storage**: View stored token in localStorage

#### Useful Console Commands
```javascript
// View stored token
localStorage.getItem('apiToken')

// Clear stored token
localStorage.removeItem('apiToken')

// Check last API request
// (visible in Network tab)
```

## Customization

### URL Parameters

The interface supports URL parameters for direct linking:

```
https://your-worker.workers.dev/?token=your-token&startTime=2023-01-01&endTime=2023-12-31&limit=500&cluster=50
```

**Supported parameters:**
- `token`: API token (overrides stored token)
- `startTime`: ISO 8601 start time
- `endTime`: ISO 8601 end time
- `limit`: Result limit
- `cluster`: Clustering distance
- `bbox`: Bounding box (URL-encoded)

### Bookmarking

You can bookmark specific views by:
1. Set your desired filters
2. Copy the URL after clicking "Load"
3. Bookmark includes all current filter settings

## Privacy and Security

### Data Handling
- All location data stays between your browser and your worker
- No third-party analytics or tracking
- Map tiles loaded from OpenStreetMap (standard practice)

### Token Security
- Tokens stored locally in browser only
- Tokens never shared with third parties
- Use HTTPS to protect token transmission

### Best Practices
- Use time-limited tokens when possible
- Regularly rotate tokens
- Don't share bookmark URLs containing tokens
- Clear browser data when using shared computers

## Future Features

Planned enhancements:
- Real-time location tracking
- Export functionality (GPX, KML)
- Advanced filtering options
- Custom map styles
- Mobile app companion