const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbProvider = "Supabase";

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required.");
}

if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
}

if (!/^https?:\/\//i.test(supabaseUrl)) {
  throw new Error("SUPABASE_URL must be the project URL, for example https://your-project.supabase.co.");
}

if (!/^eyJ/i.test(supabaseServiceRoleKey)) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY looks invalid. Copy the exact service_role secret from Supabase project settings."
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

const normalizeSupabaseError = (error, fallbackMessage = "Database request failed.") => {
  if (!error) {
    return new Error(fallbackMessage);
  }

  const missingTableMatch = String(error.message || "").match(
    /Could not find the table 'public\.([a-z_]+)' in the schema cache/i
  );

  if (missingTableMatch) {
    const tableName = missingTableMatch[1];
    const schemaError = new Error(
      `Supabase table '${tableName}' is missing. Run backend/db/schema.sql in the Supabase SQL Editor, then run 'npm run seed' from backend.`
    );
    schemaError.statusCode = 503;
    schemaError.errors = [
      {
        field: "database",
        message: schemaError.message
      }
    ];
    schemaError.code = error.code;
    return schemaError;
  }

  const normalizedError = new Error(error.message || fallbackMessage);

  normalizedError.code = error.code;
  normalizedError.details = error.details;
  normalizedError.hint = error.hint;
  normalizedError.statusCode =
    typeof error.status === "number" && error.status >= 400 && error.status < 600
      ? error.status
      : 500;

  return normalizedError;
};

const testDatabaseConnection = async () => {
  const { error } = await supabase
    .from("admins")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    throw normalizeSupabaseError(
      error,
      "Failed to connect to Supabase. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and your table schema."
    );
  }

  console.info(`${dbProvider} connected successfully.`);
};

module.exports = {
  dbProvider,
  supabase,
  normalizeSupabaseError,
  testDatabaseConnection
};
