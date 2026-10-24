/**
 * Public Supabase client configuration.
 *
 * The anon/publishable key is designed to be shipped to browser clients; row
 * level security policies restrict each authenticated user to their own row.
 * Never put a service_role or secret key in this file.
 *
 * Environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) take
 * precedence when present, so the project can be moved to another Supabase
 * project without editing this file.
 */
export const SUPABASE_URL_FALLBACK = 'https://umwlblpbuephetwoixiz.supabase.co';

export const SUPABASE_ANON_KEY_FALLBACK =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtd2xibHBidWVwaGV0d29peGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTI0NTcsImV4cCI6MjEwNzg4ODQ1N30.bjBqNz_t3PIvhlGBpaogYkA1fwKEF0s_H3yoc7YTnOE';
