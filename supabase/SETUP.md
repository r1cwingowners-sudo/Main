# Shared AIBrain content setup

1. Create a free project at https://supabase.com.
2. In **SQL Editor**, run `schema.sql`.
3. In **Authentication > Providers > Email**, enable email magic-link sign-in.
4. In **Authentication > URL Configuration**, add your Netlify website URL as a redirect URL.
5. Send me the **Project URL** and the browser-safe **Publishable/anon key** from Project Settings > API. Never share the service-role key.

Once those are added to the website, the app will read the same videos, notes, and resources for every visitor. The `admins` table plus Row Level Security keeps write access restricted to your account.
