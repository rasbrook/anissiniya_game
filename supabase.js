import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://stfhygzwjnyojbytojra.supabase.co'
const supabaseAnonKey = 'sb_publishable_Ste6DrXpxPBSJ2F0O-f3pA_1rSvOp4V'

export const SupabaseHost = createClient(supabaseUrl, supabaseAnonKey)
