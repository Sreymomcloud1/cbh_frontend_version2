import { User, SupabaseClient } from "@supabase/supabase-js";

// We target 'express-serve-static-core' because that is where 
// the Request interface is actually defined internally.
declare module 'express-serve-static-core' {
  interface Request {
    user: User;
    token: string;
    supabase: SupabaseClient<any>;
  }
}

export {};