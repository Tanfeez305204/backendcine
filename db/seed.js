const path = require("path");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const { normalizeSupabaseError, supabase } = require("../config/db");

const seedDefaultAdmin = async () => {
  try {
    const email = process.env.DEFAULT_ADMIN_EMAIL;
    const password = process.env.DEFAULT_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be set in the environment."
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const { data: existingAdmin, error: existingAdminError } = await supabase
      .from("admins")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingAdminError) {
      throw normalizeSupabaseError(existingAdminError, "Failed to check existing admin.");
    }

    if (existingAdmin) {
      console.info(`Admin already exists for ${email}.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { data: admin, error: insertAdminError } = await supabase
      .from("admins")
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash
      })
      .select("id, email, created_at")
      .single();

    if (insertAdminError) {
      throw normalizeSupabaseError(insertAdminError, "Failed to create default admin.");
    }

    console.info("Default admin created successfully:", admin);
  } catch (error) {
    console.error("Failed to seed admin:", error.message);
    process.exitCode = 1;
  }
};

seedDefaultAdmin();
