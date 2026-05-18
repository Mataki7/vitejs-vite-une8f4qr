import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cxfpczsqustvadrnqigf.supabase.co';

const supabaseKey = 'sb_publishable_T15K2PENPIe8LF7gTLu_Qw_46svYGLW';

export const supabase = createClient(supabaseUrl, supabaseKey);
