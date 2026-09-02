# Database migrations

Run from the repository root:

```powershell
alembic -c backend/alembic.ini upgrade head
```

`DATABASE_URL` selects SQLite for local development or a direct PostgreSQL/Supabase connection in production. The initial migration creates the same schema as the SQLAlchemy metadata. On PostgreSQL it also enables row-level security on application tables as defense in depth. The follow-up security migration explicitly revokes Supabase Data API privileges from `anon` and `authenticated`, including on projects whose default privileges automatically exposed newly created tables.

The FastAPI application uses a direct database connection. If the Supabase Data API is introduced later, create narrowly scoped explicit grants and RLS policies for each role; never expose the service-role key to a client.
