const db = require("../db");


const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

async function geocode(text) {
  if (!text) return null;

  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        text
      )}.json?access_token=${MAPBOX_TOKEN}`
    );

    const data = await res.json();

    if (!data.features || data.features.length === 0) return null;

    const best = data.features[0];

    return {
      lat: best.center[1],
      lng: best.center[0]
    };
  } catch (err) {
    console.error("Geocode error:", err);
    return null;
  }
}

async function run() {
  const client = await db.getClient();

  try {
    console.log("🔄 Fetching events without coordinates...");

    const result = await client.query(`
      SELECT id, location
      FROM events
      WHERE latitude IS NULL OR longitude IS NULL
    `);

    console.log(`Found ${result.rows.length} events`);

    for (const event of result.rows) {
      if (!event.location) continue;

      console.log(`📍 Geocoding: ${event.location}`);

      const geo = await geocode(event.location);

      if (!geo) {
        console.log("❌ Failed:", event.location);
        continue;
      }

      await client.query(
        `UPDATE events
         SET latitude = $1, longitude = $2
         WHERE id = $3`,
        [geo.lat, geo.lng, event.id]
      );

      console.log(`✅ Updated event ${event.id}`);
    }

    console.log("🎉 Done updating all events");
  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    client.release();
    process.exit();
  }
}

run();