/**
 * YatraBus India - Seed Data Utility
 * Populates PostgreSQL / embedded database with initial places, operators, buses, routes, timetables, and rules.
 */

import { initDatabase, getDatabasePool, isUsingPostgres } from './db';
import {
  SEED_PLACES,
  SEED_OPERATORS,
  SEED_BUSES,
  SEED_ROUTES,
  SEED_TIMETABLES,
  SEED_AUTOMATION_RULES
} from './seedData';

export async function seedDatabase(): Promise<void> {
  const dbStatus = await initDatabase();
  console.log(`Starting database seed (type: ${dbStatus.type})...`);

  if (!isUsingPostgres()) {
    console.log(`✅ In-memory DataStore initialized with:
      - ${SEED_PLACES.length} Places
      - ${SEED_OPERATORS.length} Operators
      - ${SEED_BUSES.length} Buses
      - ${SEED_ROUTES.length} Routes
      - ${SEED_TIMETABLES.length} Timetables
      - ${SEED_AUTOMATION_RULES.length} Automation Rules`);
    return;
  }

  const pool = getDatabasePool();
  if (!pool) throw new Error('Database pool not connected');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed Places
    for (const p of SEED_PLACES) {
      await client.query(`
        INSERT INTO places (id, canonical_name, place_type, state, district, latitude, longitude, source_dataset, verification_status, aliases)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [p.id, p.canonicalName, p.placeType, p.state, p.district, p.latitude, p.longitude, p.sourceDataset, p.verificationStatus, JSON.stringify(p.aliases)]);
    }

    // 2. Seed Operators
    for (const o of SEED_OPERATORS) {
      await client.query(`
        INSERT INTO operators (id, name, state, operator_type, helpline_phone, official_website, is_claim_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [o.id, o.name, o.state, o.operatorType, o.helplinePhone, o.officialWebsite, o.isClaimVerified]);
    }

    // 3. Seed Buses
    for (const b of SEED_BUSES) {
      await client.query(`
        INSERT INTO buses (id, name, operator_id, vehicle_type, status, verification_status, features)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [b.id, b.name, b.operatorId, b.vehicleType, b.status, b.verificationStatus, JSON.stringify(b.features)]);
    }

    // 4. Seed Routes
    for (const r of SEED_ROUTES) {
      await client.query(`
        INSERT INTO routes (id, route_number, name, operator_id, origin_id, origin_name, destination_id, destination_name, direction, duration_minutes, distance_km, operating_days, status, verification_status, polyline, first_departure_time, last_departure_time, frequency_minutes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO NOTHING
      `, [r.id, r.routeNumber, r.name, r.operatorId, r.originId, r.originName, r.destinationId, r.destinationName, r.direction, r.durationMinutes, r.distanceKm, r.operatingDays, r.status, r.verificationStatus, JSON.stringify(r.polyline), r.firstDepartureTime, r.lastDepartureTime, r.frequencyMinutes || 15]);

      // Seed Route Stops
      for (const s of r.stops) {
        await client.query(`
          INSERT INTO route_stops (route_id, stop_id, stop_name, sequence_order, latitude, longitude, arrival_offset_minutes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (route_id, sequence_order) DO NOTHING
        `, [r.id, s.stopId, s.stopName, s.sequenceOrder, s.latitude, s.longitude, s.arrivalOffsetMinutes]);
      }
    }

    // 5. Seed Timetables
    for (const t of SEED_TIMETABLES) {
      await client.query(`
        INSERT INTO timetables (id, route_id, bus_id, trip_code, departure_time, arrival_time, operating_days, vehicle_type, fare_in_rupees, is_confirmed, version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [t.id, t.routeId, t.busId, t.tripCode, t.departureTime, t.arrivalTime, t.operatingDays, t.vehicleType, t.fareInRupees, t.isConfirmed, t.version]);
    }

    // 6. Seed Automation Rules
    for (const rule of SEED_AUTOMATION_RULES) {
      await client.query(`
        INSERT INTO automation_rules (id, rule_name, description, threshold_value, is_enabled)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [rule.id, rule.ruleName, rule.description, rule.thresholdValue, rule.isEnabled]);
    }

    await client.query('COMMIT');
    console.log('✅ PostgreSQL database seeded successfully.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(() => {
      console.log('Seed runner completed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed runner failed:', err);
      process.exit(1);
    });
}
