# BETRIX Data Exposure API

## Overview

The Data Exposure API provides comprehensive access to all cached sports data from SportMonks and Football-Data APIs. This enables:

- **Debugging**: Inspect what data the bot has cached
- **Monitoring**: Track data availability and freshness
- **Integration**: Access sports data via HTTP for external systems
- **Analysis**: Export all cached data for further analysis
- **Development**: Test and validate data structures

## Features

✅ Access to all live matches with full detail  
✅ Access to all upcoming fixtures and scheduled matches  
✅ Full match details with all available fields from source APIs  
✅ League standings with all statistics  
✅ Available leagues from each provider  
✅ Cache status and memory usage information  
✅ Data export as JSON files  
✅ Automatic cache cleanup  

## API Endpoints

### Base URL
```
https://betrix.example.com/api/data
```

### 1. Summary - Get Overview of All Cached Data

**Endpoint**: `GET /api/data/summary`

Returns overview of cached data from all sources.

**Response**:
```json
{
  "timestamp": "2024-12-19T15:30:00.000Z",
  "sources": {
    "sportsmonks": {
      "liveMatches": 5,
      "fixtures": { "39": 20, "140": 15 },
      "standings": { "39": 1 },
      "leagues": 12
    },
    "footballdata": {
      "liveMatches": 0,
      "fixtures": { "39": 50 },
      "standings": { "39": 1 },
      "leagues": 30
    }
  }
}
```

### 2. Live Matches - Get All Live Matches from Source

**Endpoint**: `GET /api/data/live?source=sportsmonks`

**Parameters**:
- `source` (string): `sportsmonks` or `footballdata` (default: `sportsmonks`)

**Response**:
```json
{
  "source": "sportsmonks",
  "count": 5,
  "matches": [
    {
      "id": "12345",
      "homeTeam": "Manchester United",
      "awayTeam": "Liverpool",
      "status": "LIVE",
      "minute": 45,
      "score": { "home": 2, "away": 1 },
      "league": "Premier League",
      "startTime": "2024-12-19T15:00:00Z",
      "venue": "Old Trafford",
      "participants": [
        { "id": 1, "name": "Manchester United", "role": "home" },
        { "id": 2, "name": "Liverpool", "role": "away" }
      ]
    }
  ]
}
```

### 3. Fixtures - Get Upcoming Matches from League

**Endpoint**: `GET /api/data/fixtures?source=sportsmonks&league=39`

**Parameters**:
- `source` (string): `sportsmonks` or `footballdata` (default: `sportsmonks`)
- `league` (string): League ID (default: `39` = Premier League)

**League IDs**:
- `39` - Premier League (England)
- `140` - La Liga (Spain)
- `135` - Serie A (Italy)
- `61` - Ligue 1 (France)
- `78` - Bundesliga (Germany)
- `2` - Champions League (Europe)

**Response**:
```json
{
  "source": "sportsmonks",
  "league": "39",
  "count": 20,
  "fixtures": [
    {
      "id": "67890",
      "homeTeam": "Arsenal",
      "awayTeam": "Chelsea",
      "status": "SCHEDULED",
      "date": "2024-12-26T12:30:00Z",
      "league": "Premier League",
      "venue": "Emirates Stadium",
      "competition": "Premier League",
      "round": 17
    }
  ]
}
```

### 4. Match Details - Get Complete Match Data

**Endpoint**: `GET /api/data/match/:matchId?source=sportsmonks`

**Parameters**:
- `matchId` (string): Match ID from the provider
- `source` (string, optional): `sportsmonks` or `footballdata`. If omitted, returns data from all available sources.

**Response (single source)**:
```json
{
  "matchId": "12345",
  "source": "sportsmonks",
  "match": {
    "id": "12345",
    "name": "Manchester United vs Liverpool",
    "startTime": "2024-12-19T15:00:00Z",
    "endTime": "2024-12-19T16:45:00Z",
    "status": "FINISHED",
    "homeTeam": { "id": 1, "name": "Manchester United" },
    "awayTeam": { "id": 2, "name": "Liverpool" },
    "score": { "home": 2, "away": 1 },
    "minute": 90,
    "period": "FT",
    "venue": "Old Traditonal Arena",
    "league": { "id": 39, "name": "Premier League" },
    "events": [
      { "minute": 10, "type": "goal", "team": "home", "player": "Bruno Fernandes", "assist": "Marcus Rashford" },
      { "minute": 25, "type": "card", "team": "away", "player": "Mohamed Salah", "card": "yellow" }
    ]
  }
}
```

**Response (all sources)**:
```json
{
  "id": "12345",
  "sportsmonks": { /* full match data from SportMonks */ },
  "footballdata": { /* full match data from Football-Data */ },
  "retrieved": "2024-12-19T15:30:00.000Z"
}
```

### 5. Standings - Get League Table

**Endpoint**: `GET /api/data/standings/:leagueId?source=sportsmonks`

**Parameters**:
- `leagueId` (string): League ID (e.g., `39` for Premier League)
- `source` (string): `sportsmonks` or `footballdata` (default: `sportsmonks`)

**Response**:
```json
{
  "leagueId": "39",
  "source": "sportsmonks",
  "standings": {
    "standings": [
      {
        "position": 1,
        "team": {
          "id": 1,
          "name": "Manchester City",
          "logo": "https://..."
        },
        "played": 17,
        "won": 14,
        "drawn": 2,
        "lost": 1,
        "goalsFor": 52,
        "goalsAgainst": 15,
        "goalDifference": 37,
        "points": 44
      }
    ]
  }
}
```

### 6. Leagues - Get Available Leagues

**Endpoint**: `GET /api/data/leagues?source=sportsmonks`

**Parameters**:
- `source` (string): `sportsmonks` or `footballdata` (default: `sportsmonks`)

**Response**:
```json
{
  "source": "sportsmonks",
  "count": 250,
  "leagues": [
    {
      "id": 39,
      "name": "Premier League",
      "country": "England",
      "code": "E0",
      "season": 2024,
      "active": true
    }
  ]
}
```

### 7. Cache Info - Get Cache Status and Statistics

**Endpoint**: `GET /api/data/cache-info`

Returns detailed cache status, memory usage, and TTL information.

**Response**:
```json
{
  "timestamp": "2024-12-19T15:30:00.000Z",
  "source": "memory",
  "totalSize": 524288,
  "totalEntries": 45,
  "estimatedSizeKb": "512.00",
  "entries": [
    {
      "key": "raw:live:sportsmonks",
      "size": 8192,
      "expiresIn": 95,
      "dataType": "Array[5]"
    },
    {
      "key": "raw:fixtures:sportsmonks:39",
      "size": 16384,
      "expiresIn": 285,
      "dataType": "Array[20]"
    }
  ]
}
```

### 8. Cache Cleanup - Manually Trigger Cleanup

**Endpoint**: `POST /api/data/cache-cleanup`

Manually removes expired cache entries.

**Response**:
```json
{
  "success": true,
  "cleaned": 3,
  "message": "Removed 3 expired cache entries"
}
```

### 9. Export - Export All Cached Data

**Endpoint**: `GET /api/data/export`

Returns all cached data as a JSON file download.

**Response**:
```json
{
  "exportedAt": "2024-12-19T15:30:00.000Z",
  "summary": {
    "timestamp": "2024-12-19T15:30:00.000Z",
    "sources": { /* ... */ }
  },
  "data": {
    "sportsmonks": {
      "live": [ /* all live matches */ ],
      "leagues": [ /* all leagues */ ]
    },
    "footballdata": {
      "live": [ /* all live matches */ ]
    }
  }
}
```

### 10. Schema - Get API Documentation

**Endpoint**: `GET /api/data/schema`

Returns the complete API schema and documentation.

**Response**:
```json
{
  "version": "1.0",
  "description": "Sports Data Exposure API - Access all cached sports data",
  "endpoints": {
    "GET /api/data/summary": {
      "description": "Overview of all cached data",
      "response": { "summary": "object" }
    },
    // ... all other endpoints documented
  },
  "sources": ["sportsmonks", "footballdata"],
  "majorLeagues": {
    "39": "Premier League",
    "140": "La Liga",
    "135": "Serie A",
    "61": "Ligue 1",
    "78": "Bundesliga",
    "2": "Champions League"
  }
}
```

## Usage Examples

### Get All Live Matches
```bash
curl https://betrix.example.com/api/data/live?source=sportsmonks
```

### Get Premier League Fixtures
```bash
curl https://betrix.example.com/api/data/fixtures?source=sportsmonks&league=39
```

### Get Specific Match Details
```bash
curl https://betrix.example.com/api/data/match/12345?source=sportsmonks
```

### Get Premier League Standings
```bash
curl https://betrix.example.com/api/data/standings/39?source=sportsmonks
```

### Export All Data
```bash
curl https://betrix.example.com/api/data/export > sports-data.json
```

### Check Cache Status
```bash
curl https://betrix.example.com/api/data/cache-info
```

## Caching Strategy

The Data Exposure API uses automatic TTL-based caching:

| Data Type | TTL | Purpose |
|-----------|-----|---------|
| Live Matches | 2 minutes | Real-time updates |
| Fixtures/Upcoming | 5 minutes | Regular updates |
| Standings | 10 minutes | Less frequent changes |
| Leagues | 24 hours | Rarely changes |

## Data Flow

```
SportMonks API ──┐
                  ├─→ Sports Aggregator ──→ RawDataCache ──→ Data Exposure API
Football-Data ──┘
     ↓
  Prefetch Scheduler (60s interval)
  Updates cache automatically
```

## Implementation Details

### RawDataCache Service

The `RawDataCache` service preserves all raw API responses with metadata:

```typescript
class RawDataCache {
  // Store raw API data with TTL
  store(key: string, data: any, ttl: number)
  
  // Retrieve with expiration check
  get(key: string): Promise<CachedData>
  
  // Specialized storage methods
  storeLiveMatches(source: string, matches: array)
  storeFixtures(source: string, leagueId: string, fixtures: array)
  storeMatch(matchId: string, source: string, matchData: object)
  storeStandings(leagueId: string, source: string, standings: object)
  storeLeagues(source: string, leagues: array)
  
  // Cleanup and export
  cleanup(): Promise<number>
  exportAll(): Promise<CacheExport>
}
```

### DataExposureHandler

The `DataExposureHandler` class registers all REST endpoints:

```typescript
class DataExposureHandler {
  constructor(router: express.Router, sportsAggregator: SportsAggregator)
  
  registerRoutes()  // Registers all /api/data/* endpoints
}
```

## Integration with Sports Aggregator

The sports aggregator automatically populates the data cache:

1. **getAllLiveMatches()** stores raw match data
2. **getUpcomingMatches(leagueId)** stores raw fixtures
3. **Prefetch scheduler** updates cache every 60 seconds

## Error Handling

All endpoints return consistent error responses:

```json
{
  "statusCode": 500,
  "error": "Cache retrieval failed",
  "message": "Detailed error message"
}
```

## Security Considerations

- No authentication required (read-only endpoints)
- Rate limiting applies to prevent abuse
- Data is limited to cached information only
- Sensitive API keys never exposed

## Future Enhancements

- WebSocket real-time updates
- GraphQL alternative endpoints
- Advanced filtering and search
- Historical data retention
- Custom data export formats (CSV, XML)

## Support

For issues or questions about the Data Exposure API:

1. Check `/api/data/schema` for latest documentation
2. Verify cache status at `/api/data/cache-info`
3. Review logs for data availability
4. Export data for offline analysis via `/api/data/export`

---

**BETRIX Data Exposure API v1.0**  
*Last Updated: 2024-12-19*
