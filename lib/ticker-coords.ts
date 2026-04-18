/**
 * Company HQ coordinates for common tickers.
 * Used as a higher-resolution fallback when only country-level data is available.
 * Coordinates are city-level (company HQ city), not country centroids.
 */
export const TICKER_COORDS: Record<string, { lat: number; lon: number }> = {
  // ── California ────────────────────────────────────────────────────────────
  AAPL:   { lat: 37.33,  lon: -122.03 }, // Cupertino
  GOOGL:  { lat: 37.42,  lon: -122.08 }, // Mountain View
  GOOG:   { lat: 37.42,  lon: -122.08 }, // Mountain View
  META:   { lat: 37.45,  lon: -122.18 }, // Menlo Park
  NVDA:   { lat: 37.36,  lon: -121.97 }, // Santa Clara
  INTC:   { lat: 37.38,  lon: -121.96 }, // Santa Clara
  AMD:    { lat: 37.33,  lon: -121.90 }, // Santa Clara
  NFLX:   { lat: 37.23,  lon: -121.98 }, // Los Gatos
  ADBE:   { lat: 37.33,  lon: -121.89 }, // San Jose
  CRM:    { lat: 37.77,  lon: -122.41 }, // San Francisco
  SNOW:   { lat: 37.53,  lon: -122.04 }, // San Mateo
  NOW:    { lat: 37.40,  lon: -121.98 }, // Santa Clara
  PANW:   { lat: 37.45,  lon: -122.01 }, // Santa Clara
  AMAT:   { lat: 37.38,  lon: -121.97 }, // Santa Clara
  KLAC:   { lat: 37.36,  lon: -122.04 }, // San Jose
  LRCX:   { lat: 37.61,  lon: -122.01 }, // Fremont
  SNPS:   { lat: 37.39,  lon: -122.03 }, // Sunnyvale
  CDNS:   { lat: 37.37,  lon: -121.97 }, // San Jose
  INTU:   { lat: 37.45,  lon: -122.16 }, // Mountain View
  FISV:   { lat: 37.53,  lon: -122.03 }, // San Mateo
  PYPL:   { lat: 37.38,  lon: -121.99 }, // San Jose
  EBAY:   { lat: 37.37,  lon: -121.97 }, // San Jose
  V:      { lat: 37.56,  lon: -122.27 }, // Foster City
  QCOM:   { lat: 32.90,  lon: -117.19 }, // San Diego
  AVGO:   { lat: 37.39,  lon: -122.09 }, // Palo Alto
  ANET:   { lat: 37.45,  lon: -122.18 }, // Santa Clara
  ORCL:   { lat: 37.53,  lon: -122.25 }, // Redwood City
  HPQ:    { lat: 37.33,  lon: -122.03 }, // Palo Alto
  HPE:    { lat: 37.39,  lon: -121.98 }, // San Jose
  UBER:   { lat: 37.77,  lon: -122.42 }, // San Francisco
  LYFT:   { lat: 37.77,  lon: -122.44 }, // San Francisco
  TWLO:   { lat: 37.78,  lon: -122.39 }, // San Francisco
  ZM:     { lat: 37.37,  lon: -121.99 }, // San Jose
  DOCU:   { lat: 37.78,  lon: -122.39 }, // San Francisco
  RH:     { lat: 37.94,  lon: -122.35 }, // Corte Madera
  HOOD:   { lat: 37.45,  lon: -122.18 }, // Menlo Park
  COIN:   { lat: 37.77,  lon: -122.41 }, // San Francisco
  RBL:    { lat: 37.56,  lon: -122.32 }, // San Mateo
  SOFI:   { lat: 37.79,  lon: -122.39 }, // San Francisco
  SQ:     { lat: 37.77,  lon: -122.41 }, // San Francisco (Block)
  COST:   { lat: 47.53,  lon: -122.03 }, // Issaquah, WA

  // ── Washington ────────────────────────────────────────────────────────────
  MSFT:   { lat: 47.64,  lon: -122.13 }, // Redmond
  AMZN:   { lat: 47.61,  lon: -122.34 }, // Seattle
  EXPD:   { lat: 47.61,  lon: -122.29 }, // Seattle
  SBUX:   { lat: 47.61,  lon: -122.33 }, // Seattle

  // ── Texas ─────────────────────────────────────────────────────────────────
  TSLA:   { lat: 30.27,  lon: -97.74  }, // Austin
  DELL:   { lat: 30.51,  lon: -97.67  }, // Round Rock
  TXN:    { lat: 32.77,  lon: -96.79  }, // Dallas
  AT:     { lat: 32.78,  lon: -96.80  }, // Dallas (AT&T)
  T:      { lat: 32.78,  lon: -96.80  }, // Dallas
  EXC:    { lat: 41.88,  lon: -87.63  }, // Chicago (alt)
  XOM:    { lat: 32.78,  lon: -96.82  }, // Irving, TX
  CVX:    { lat: 29.76,  lon: -95.49  }, // Houston
  COP:    { lat: 29.76,  lon: -95.52  }, // Houston
  EOG:    { lat: 29.76,  lon: -95.37  }, // Houston
  SLB:    { lat: 29.76,  lon: -95.36  }, // Houston
  HAL:    { lat: 29.77,  lon: -95.55  }, // Houston
  PSX:    { lat: 29.72,  lon: -95.56  }, // Houston
  PLTR:   { lat: 39.75,  lon: -104.99 }, // Denver, CO

  // ── New York ──────────────────────────────────────────────────────────────
  JPM:    { lat: 40.75,  lon: -73.98  }, // Midtown Manhattan
  GS:     { lat: 40.71,  lon: -74.01  }, // Lower Manhattan
  MS:     { lat: 40.76,  lon: -73.98  }, // Midtown Manhattan
  C:      { lat: 40.72,  lon: -74.00  }, // Manhattan
  AXP:    { lat: 40.75,  lon: -74.01  }, // Manhattan
  BK:     { lat: 40.71,  lon: -74.01  }, // Manhattan
  BLK:    { lat: 40.76,  lon: -73.97  }, // Manhattan
  ICE:    { lat: 40.71,  lon: -74.01  }, // Manhattan
  SCHW:   { lat: 37.78,  lon: -122.40 }, // San Francisco
  COF:    { lat: 38.88,  lon: -77.44  }, // McLean, VA
  BR:     { lat: 40.77,  lon: -73.71  }, // Lake Success, NY (Broadridge)
  MA:     { lat: 41.05,  lon: -73.71  }, // Purchase, NY
  CB:     { lat: 40.75,  lon: -73.97  }, // Manhattan
  MET:    { lat: 40.75,  lon: -73.99  }, // Manhattan
  PARA:   { lat: 40.75,  lon: -73.98  }, // Manhattan
  WBD:    { lat: 40.75,  lon: -73.98  }, // Manhattan
  PRU:    { lat: 40.74,  lon: -74.17  }, // Newark, NJ
  JNJ:    { lat: 40.49,  lon: -74.45  }, // New Brunswick, NJ
  PFE:    { lat: 40.76,  lon: -73.98  }, // Manhattan
  MRK:    { lat: 40.81,  lon: -74.29  }, // Kenilworth, NJ
  BMY:    { lat: 40.76,  lon: -73.98  }, // Manhattan
  LLY:    { lat: 39.78,  lon: -86.15  }, // Indianapolis, IN
  ABBV:   { lat: 42.30,  lon: -87.97  }, // North Chicago, IL
  AMGN:   { lat: 34.16,  lon: -118.40 }, // Thousand Oaks, CA
  GILD:   { lat: 37.50,  lon: -122.26 }, // Foster City, CA
  REGN:   { lat: 41.10,  lon: -73.79  }, // Tarrytown, NY
  VRTX:   { lat: 42.36,  lon: -71.06  }, // Boston, MA
  BIIB:   { lat: 42.36,  lon: -71.06  }, // Cambridge, MA
  MRNA:   { lat: 42.36,  lon: -71.06  }, // Cambridge, MA
  ZTS:    { lat: 40.67,  lon: -74.39  }, // Parsippany, NJ

  // ── Illinois ──────────────────────────────────────────────────────────────
  BA:     { lat: 41.88,  lon: -87.63  }, // Chicago
  MCD:    { lat: 41.88,  lon: -87.63  }, // Chicago
  CAT:    { lat: 40.69,  lon: -89.59  }, // Peoria, IL
  ADM:    { lat: 41.86,  lon: -87.64  }, // Chicago
  CME:    { lat: 41.88,  lon: -87.63  }, // Chicago
  WBA:    { lat: 42.11,  lon: -87.85  }, // Deerfield, IL

  // ── Massachusetts ─────────────────────────────────────────────────────────
  GE:     { lat: 42.36,  lon: -71.06  }, // Boston
  ISRG:   { lat: 37.33,  lon: -121.89 }, // Sunnyvale, CA (alt)
  RTX:    { lat: 41.76,  lon: -72.68  }, // Farmington, CT

  // ── Georgia ───────────────────────────────────────────────────────────────
  HD:     { lat: 33.75,  lon: -84.39  }, // Atlanta
  UPS:    { lat: 33.75,  lon: -84.39  }, // Atlanta
  KO:     { lat: 33.79,  lon: -84.39  }, // Atlanta

  // ── Ohio ──────────────────────────────────────────────────────────────────
  PG:     { lat: 39.10,  lon: -84.51  }, // Cincinnati
  PM:     { lat: 39.10,  lon: -84.51  }, // Cincinnati (alt)
  MO:     { lat: 37.50,  lon: -77.45  }, // Richmond, VA

  // ── Minnesota ─────────────────────────────────────────────────────────────
  UNH:    { lat: 44.93,  lon: -93.47  }, // Minnetonka
  MMM:    { lat: 44.95,  lon: -93.09  }, // St. Paul

  // ── Arkansas ──────────────────────────────────────────────────────────────
  WMT:    { lat: 36.37,  lon: -94.21  }, // Bentonville

  // ── Nebraska ──────────────────────────────────────────────────────────────
  "BRK.A": { lat: 41.26, lon: -95.94  }, // Omaha
  "BRK.B": { lat: 41.26, lon: -95.94  }, // Omaha

  // ── North Carolina ────────────────────────────────────────────────────────
  MSCI:   { lat: 35.22,  lon: -80.84  }, // Charlotte

  // ── Virginia ──────────────────────────────────────────────────────────────
  GD:     { lat: 38.88,  lon: -77.44  }, // Reston
  LMT:    { lat: 38.97,  lon: -77.00  }, // Bethesda, MD
  LDOS:   { lat: 38.88,  lon: -77.11  }, // Reston
  MSTR:   { lat: 38.92,  lon: -77.23  }, // Tysons, VA

  // ── International ─────────────────────────────────────────────────────────
  TSM:    { lat: 24.78,  lon: 120.99  }, // Hsinchu, Taiwan
  ASML:   { lat: 51.45,  lon: 5.47    }, // Veldhoven, Netherlands
  SAP:    { lat: 49.29,  lon: 8.64    }, // Walldorf, Germany
  TM:     { lat: 35.08,  lon: 137.15  }, // Toyota City, Japan
  SONY:   { lat: 35.66,  lon: 139.73  }, // Tokyo, Japan
  NVO:    { lat: 55.77,  lon: 12.53   }, // Bagsværd, Denmark
  LVMUY:  { lat: 48.87,  lon: 2.30    }, // Paris, France
  INFY:   { lat: 12.97,  lon: 77.59   }, // Bengaluru, India
  WIT:    { lat: 17.44,  lon: 78.38   }, // Hyderabad, India
  BABA:   { lat: 30.27,  lon: 120.15  }, // Hangzhou, China
  TCEHY:  { lat: 22.54,  lon: 114.06  }, // Shenzhen, China
  PDD:    { lat: 31.23,  lon: 121.47  }, // Shanghai, China
  JD:     { lat: 39.91,  lon: 116.39  }, // Beijing, China
  SHOP:   { lat: 45.42,  lon: -75.70  }, // Ottawa, Canada
  RY:     { lat: 43.65,  lon: -79.38  }, // Toronto, Canada
  TD:     { lat: 43.65,  lon: -79.38  }, // Toronto, Canada
  CNQ:    { lat: 51.05,  lon: -114.07 }, // Calgary, Canada
  "005930": { lat: 37.27, lon: 127.03 }, // Samsung — Suwon, South Korea
};
