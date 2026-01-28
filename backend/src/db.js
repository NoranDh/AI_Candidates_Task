import pg from "pg";

const { Pool } = pg;

// TODO (candidate):
// - Use this pool to run queries
// - Handle connection errors if needed

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});


export async function insertTriage({text, resultJson, model = "mock", latency = 0}) {

  const query = `
  INSERT INTO "TriageRequests"
("InputText", "ResultJson", "Model", "Latency" )
VALUES
($1, $2::jsonb, $3, $4)
RETURNING "TriageID";
  `;

  const values = [
    text, 
    JSON.stringify(resultJson),
    model,
    latency
  ];

  const r = await pool.query(query, values);

  return {
    id: r.rows[0].TriageID,
    created_at: r.rows[0].CreatedAt,
  };

}

// geting a single triage record by id

export async function getTriageById(id) {
  const query = `
    SELECT "TriageID", "InputText", "ResultJson", "CreatedAt"
    FROM "TriageRequests"
    WHERE "TriageID" = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0){
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.TriageID,
      text: row.InputText,
      ...row.ResultJson,
      created_at: row.Created_at
    };
  
}

// get recent triage requests 

export async function getRecentTriages(limit = 10) {
  const query = `
    SELECT "TriageID", "InputText", "ResultJson", "CreatedAt"
    FROM "TriageRequests"
    ORDER BY "CreatedAt" DESC
    LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

     
   return result.rows.map( row => ({
      id: row.TriageID,
      text: row.InputText,
      ...row.ResultJson,
      created_at: row.Created_at
    }));

    

  
}