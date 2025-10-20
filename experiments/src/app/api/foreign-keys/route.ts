import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(request: NextRequest) {
  try {
    const { env, schema } = await request.json();
    
    if (!env || !schema) {
      return NextResponse.json(
        { error: "Environment and schema are required" },
        { status: 400 }
      );
    }

    const connectionString = process.env.DEMO_POSTGRES_DATABASE_URL;
    
    if (!connectionString) {
      return NextResponse.json(
        { error: "Database connection string not configured" },
        { status: 500 }
      );
    }

    const client = new Client({ 
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
    await client.connect();

    // Query to get foreign key relationships
    const result = await client.query(`
      SELECT
        tc.table_name AS from_table,
        kcu.column_name AS from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
      ORDER BY tc.table_name, kcu.ordinal_position;
    `, [schema]);

    await client.end();

    const foreignKeys = result.rows.map((row) => ({
      fromTable: row.from_table,
      fromColumn: row.from_column,
      toTable: row.to_table,
      toColumn: row.to_column,
      constraintName: row.constraint_name
    }));
    
    return NextResponse.json({ foreignKeys });
  } catch (error) {
    console.error("Error fetching foreign keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch foreign keys" },
      { status: 500 }
    );
  }
}

