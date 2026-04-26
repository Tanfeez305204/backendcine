# Backend Data Setup

Use these separate files when you want to initialize only the data layer.

## 1. Supabase Tables

Run this file in the Supabase SQL Editor:

- `backend/db/supabase-init.sql`

This creates:

- `admins`
- `categories`
- `movies`
- `movie_language` enum
- `trg_movies_updated_at` trigger

After that, create the default admin from the backend folder:

```bash
npm run seed
```

## 2. Redis Keys

Redis does not use tables in this project. It only uses keys.

Run this from the backend folder:

```bash
npm run redis:init
```

This checks Redis and creates the base cache key:

- `cache:movies:list:version`

These keys are created automatically by the app later:

- `movies:list:*`
- `auth:refresh:*`

## Run Order

1. Run `backend/db/supabase-init.sql` in Supabase.
2. Run `npm run seed`.
3. Run `npm run redis:init`.
