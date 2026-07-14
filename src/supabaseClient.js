import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bhoerukocpdfflbuyewp.supabase.co'
const supabaseKey = 'sb_publishable_J1dYT9qFgQJJoSHkuYnGmg_L2lMMPi6'

export const supabase = createClient(supabaseUrl, supabaseKey)
