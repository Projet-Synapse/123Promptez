// Cloud sync service — persists all app data to OnSpace Cloud for the logged-in user
import { getSupabaseClient } from '@/template';

type DataType = 'workspaces' | 'bot_config' | 'profile';

export async function saveToCloud(userId: string, dataType: DataType, data: unknown): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('user_app_data')
    .upsert(
      { user_id: userId, data_type: dataType, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,data_type' }
    );
  if (error) {
    console.error(`[CloudSync] Failed to save ${dataType}:`, error.message);
  }
}

export async function loadFromCloud(userId: string, dataType: DataType): Promise<unknown | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_app_data')
    .select('data')
    .eq('user_id', userId)
    .eq('data_type', dataType)
    .maybeSingle();
  if (error) {
    console.error(`[CloudSync] Failed to load ${dataType}:`, error.message);
    return null;
  }
  return data?.data ?? null;
}

export async function loadAllUserData(userId: string): Promise<Record<DataType, unknown>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_app_data')
    .select('data_type, data')
    .eq('user_id', userId);
  if (error || !data) return { workspaces: null, bot_config: null, profile: null } as any;
  const result: Record<string, unknown> = {};
  for (const row of data) {
    result[row.data_type] = row.data;
  }
  return result as Record<DataType, unknown>;
}
