import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import type { Vehicle, VehicleInsert, VehicleMake, VehicleModel } from '@/types/database';

// ---------------------------------------------------------------------------
// Vehicle Service
// Handles static make/model catalog lookups, garage CRUD, and photo uploads
// ---------------------------------------------------------------------------

/**
 * Fetch all available vehicle makes sorted alphabetically.
 */
export async function fetchMakes(): Promise<VehicleMake[]> {
  const { data, error } = await supabase
    .from('vehicle_makes')
    .select('*')
    .eq('status', 'approved')
    .order('name', { ascending: true });

  if (error) {
    console.error('[VehicleService] Failed to fetch makes:', error.message);
    throw new Error(`Failed to load vehicle makes: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch all models for a specific make ID sorted alphabetically.
 */
export async function fetchModels(makeId: string): Promise<VehicleModel[]> {
  const { data, error } = await supabase
    .from('vehicle_models')
    .select('*')
    .eq('make_id', makeId)
    .eq('status', 'approved')
    .order('name', { ascending: true });

  if (error) {
    console.error(`[VehicleService] Failed to fetch models for make ${makeId}:`, error.message);
    throw new Error(`Failed to load vehicle models: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch all vehicles owned by a specific user, primary vehicle first.
 */
export async function fetchUserVehicles(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`[VehicleService] Failed to fetch vehicles for user ${userId}:`, error.message);
    throw new Error(`Failed to load user vehicles: ${error.message}`);
  }

  return data ?? [];
}

export interface CreateVehicleInput {
  userId: string;
  make: string;
  model: string;
  year: number;
  odometer?: number;
  nickname?: string | null;
  isPrimary?: boolean;
  localPhotoUri?: string | null;
  // Catalogue linkage — populated when user selects from the picker
  makeId?: string | null;
  modelId?: string | null;
  isCustom?: boolean;
}

/**
 * Create a new vehicle in the user's garage.
 * If marked as primary or if this is the user's first vehicle,
 * unsets primary on all other vehicles for this user first.
 */
export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const { userId, make, model, year, odometer = 0, nickname, isPrimary, localPhotoUri } = input;

  // Check if user has any existing vehicles
  const existingVehicles = await fetchUserVehicles(userId);
  const shouldBePrimary = isPrimary || existingVehicles.length === 0;

  if (shouldBePrimary && existingVehicles.length > 0) {
    // Unset current primary vehicle
    const { error: unsetError } = await supabase
      .from('vehicles')
      .update({ is_primary: false })
      .eq('user_id', userId);

    if (unsetError) {
      console.error('[VehicleService] Failed to reset primary vehicle status:', unsetError.message);
      throw new Error(`Failed to update existing primary vehicle: ${unsetError.message}`);
    }
  }

  const insertPayload: VehicleInsert = {
    user_id: userId,
    make,
    model,
    year,
    odometer: Math.max(0, Math.round(odometer)),
    nickname: nickname?.trim() || null,
    is_primary: shouldBePrimary,
    photo_url: null,
    // Catalogue linkage (nullable — backwards-compatible)
    make_id: input.makeId ?? null,
    model_id: input.modelId ?? null,
    is_custom: input.isCustom ?? false,
  };

  const { data, error } = await supabase
    .from('vehicles')
    .insert(insertPayload)
    .select()
    .single();

  if (error || !data) {
    console.error('[VehicleService] Failed to create vehicle:', error?.message);
    throw new Error(`Failed to save vehicle: ${error?.message ?? 'Unknown error'}`);
  }

  let finalVehicle: Vehicle = data;

  // Upload photo if provided
  if (localPhotoUri) {
    try {
      const photoUrl = await uploadVehiclePhoto(userId, data.id, localPhotoUri);
      finalVehicle = { ...data, photo_url: photoUrl };
    } catch (photoErr) {
      console.warn('[VehicleService] Vehicle created but photo upload failed:', photoErr);
      // We don't fail the whole creation if photo upload encounters an issue
    }
  }

  return finalVehicle;
}

/**
 * Set a vehicle as the primary vehicle for the user.
 */
export async function setPrimaryVehicle(userId: string, vehicleId: string): Promise<void> {
  // Step 1: Unset is_primary for all vehicles of this user
  const { error: unsetError } = await supabase
    .from('vehicles')
    .update({ is_primary: false })
    .eq('user_id', userId);

  if (unsetError) {
    console.error('[VehicleService] Failed to clear primary status:', unsetError.message);
    throw new Error(`Failed to clear primary status: ${unsetError.message}`);
  }

  // Step 2: Set is_primary = true for the target vehicle
  const { error: setError } = await supabase
    .from('vehicles')
    .update({ is_primary: true })
    .eq('id', vehicleId)
    .eq('user_id', userId);

  if (setError) {
    console.error(`[VehicleService] Failed to set primary for vehicle ${vehicleId}:`, setError.message);
    throw new Error(`Failed to set primary vehicle: ${setError.message}`);
  }
}

/**
 * Delete a vehicle from the user's garage.
 * If the deleted vehicle was primary, automatically promotes the next newest vehicle.
 */
export async function deleteVehicle(userId: string, vehicleId: string): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', vehicleId)
    .eq('user_id', userId);

  if (error) {
    console.error(`[VehicleService] Failed to delete vehicle ${vehicleId}:`, error.message);
    throw new Error(`Failed to delete vehicle: ${error.message}`);
  }

  // Check remaining vehicles; if none is primary, promote the most recent one
  const remaining = await fetchUserVehicles(userId);
  if (remaining.length > 0 && !remaining.some((v) => v.is_primary)) {
    await setPrimaryVehicle(userId, remaining[0].id);
  }

  // Clean up storage photo silently in background
  const photoPath = `${userId}/${vehicleId}.jpg`;
  void supabase.storage.from('vehicle-photos').remove([photoPath]);
}

/**
 * Helper to derive thumbnail URL from a vehicle photo URL.
 */
export function getVehicleThumbnailUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.includes('_thumb.jpg')) return photoUrl;
  return photoUrl.replace('.jpg', '_thumb.jpg');
}

/**
 * Client-side resize and compression before uploading to Supabase Storage.
 * Resizes main photo to 1280px wide (JPEG 85%) and thumbnail to 256px wide (JPEG 80%).
 * Paths:
 *   vehicle-photos/{userId}/{vehicleId}.jpg
 *   vehicle-photos/{userId}/{vehicleId}_thumb.jpg
 */
export async function uploadVehiclePhoto(
  userId: string,
  vehicleId: string,
  localUri: string,
): Promise<string> {
  // 1. Client-side resize for main hero photo (1280px max width)
  const mainManipulated = await manipulateAsync(
    localUri,
    [{ resize: { width: 1280 } }],
    { compress: 0.85, format: SaveFormat.JPEG },
  );

  // 2. Client-side resize for avatar / switcher thumbnail (256px max width)
  const thumbManipulated = await manipulateAsync(
    localUri,
    [{ resize: { width: 256 } }],
    { compress: 0.8, format: SaveFormat.JPEG },
  );

  // 3. Convert both to binary array buffers
  const [mainRes, thumbRes] = await Promise.all([
    fetch(mainManipulated.uri),
    fetch(thumbManipulated.uri),
  ]);
  const [mainBuffer, thumbBuffer] = await Promise.all([
    mainRes.arrayBuffer(),
    thumbRes.arrayBuffer(),
  ]);

  // 4. Upload both to Supabase Storage bucket
  const mainPath = `${userId}/${vehicleId}.jpg`;
  const thumbPath = `${userId}/${vehicleId}_thumb.jpg`;

  const [{ error: mainError }, { error: thumbError }] = await Promise.all([
    supabase.storage.from('vehicle-photos').upload(mainPath, mainBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    }),
    supabase.storage.from('vehicle-photos').upload(thumbPath, thumbBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    }),
  ]);

  if (mainError) {
    console.error('[VehicleService] Main photo upload failed:', mainError.message);
    throw new Error(`Photo upload failed: ${mainError.message}`);
  }
  if (thumbError) {
    console.warn('[VehicleService] Thumbnail upload warning:', thumbError.message);
  }

  // 5. Retrieve public URL with timestamp cache buster
  const { data: urlData } = supabase.storage
    .from('vehicle-photos')
    .getPublicUrl(mainPath);

  const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // 6. Update vehicle record with new photo_url
  const { error: updateError } = await supabase
    .from('vehicles')
    .update({ photo_url: photoUrl })
    .eq('id', vehicleId)
    .eq('user_id', userId);

  if (updateError) {
    console.error('[VehicleService] Failed to update vehicle photo URL:', updateError.message);
    throw new Error(`Failed to link photo to vehicle: ${updateError.message}`);
  }

  return photoUrl;
}

/**
 * Update general vehicle details (nickname, odometer, make, model, year).
 */
export async function updateVehicle(
  userId: string,
  vehicleId: string,
  updates: Partial<{
    nickname: string | null;
    odometer: number;
    make: string;
    model: string;
    year: number;
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.nickname !== undefined) payload.nickname = updates.nickname?.trim() || null;
  if (updates.odometer !== undefined) payload.odometer = Math.max(0, Math.round(updates.odometer));
  if (updates.make !== undefined) payload.make = updates.make.trim();
  if (updates.model !== undefined) payload.model = updates.model.trim();
  if (updates.year !== undefined) payload.year = updates.year;

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from('vehicles')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq('id', vehicleId)
    .eq('user_id', userId);

  if (error) {
    console.error(`[VehicleService] Failed to update vehicle ${vehicleId}:`, error.message);
    throw new Error(`Failed to update vehicle: ${error.message}`);
  }
}

/**
 * Move all trips from one vehicle to another via database RPC.
 */
export async function moveTripsToVehicle(
  fromVehicleId: string,
  toVehicleId: string,
): Promise<number> {
  // RPC is a raw SQL function not yet in the generated schema — bypass type checking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('move_trips_to_vehicle', {
    p_from_vehicle_id: fromVehicleId,
    p_to_vehicle_id: toVehicleId,
  });

  if (error) {
    console.error('[VehicleService] Failed to move trips:', error.message);
    throw new Error(`Failed to move drives: ${error.message}`);
  }

  return (data as number) ?? 0;
}

/**
 * Update a vehicle's odometer mileage.
 */
export async function updateVehicleOdometer(
  userId: string,
  vehicleId: string,
  odometerKm: number,
): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({ odometer: Math.max(0, Math.round(odometerKm)) })
    .eq('id', vehicleId)
    .eq('user_id', userId);

  if (error) {
    console.error('[VehicleService] Failed to update vehicle odometer:', error.message);
    throw new Error(`Failed to update odometer: ${error.message}`);
  }
}

/**
 * Fetch trips belonging to user that currently have no vehicle attached.
 */
export async function fetchUnassignedTrips(userId: string) {
  const { data, error } = await supabase
    .from('trips')
    .select('id, distance_m, duration_s, started_at, top_speed, avg_speed')
    .eq('user_id', userId)
    .is('vehicle_id', null)
    .order('started_at', { ascending: false });

  if (error) {
    console.warn('[VehicleService] Failed to fetch unassigned trips:', error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Attach unassigned drives (or specific trips) to a vehicle using database RPC.
 */
export async function attachDrivesToVehicle(
  vehicleId: string,
  tripIds?: string[],
): Promise<number> {
  const { data, error } = await supabase.rpc('attach_drives_to_vehicle', {
    p_vehicle_id: vehicleId,
    p_trip_ids: tripIds ?? undefined,
  });

  if (error) {
    console.error('[VehicleService] Failed to attach drives to vehicle:', error.message);
    throw new Error(`Failed to attach drives: ${error.message}`);
  }

  return data ?? 0;
}

/**
 * Levenshtein distance string similarity metric (0.0 to 1.0).
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  match?: {
    make: string;
    model: string;
    confidence: number;
  };
}

/**
 * Fuzzy check candidate make & model against catalogue to prevent duplicate entries.
 */
export async function checkVehicleDuplicate(
  candidateMake: string,
  candidateModel: string,
): Promise<DuplicateCheckResult> {
  try {
    const makes = await fetchMakes();
    const cleanMake = candidateMake.trim();
    const cleanModel = candidateModel.trim();

    // 1. Find best matching make
    let bestMakeMatch: { make: VehicleMake; score: number } | null = null;
    for (const m of makes) {
      const score = stringSimilarity(cleanMake, m.name);
      if (score >= 0.72 && (!bestMakeMatch || score > bestMakeMatch.score)) {
        bestMakeMatch = { make: m, score };
      }
    }

    if (!bestMakeMatch) {
      return { isDuplicate: false };
    }

    // 2. Fetch models for matched make
    const models = await fetchModels(bestMakeMatch.make.id);
    let bestModelMatch: { model: VehicleModel; score: number } | null = null;
    for (const mod of models) {
      const score = stringSimilarity(cleanModel, mod.name);
      if (score >= 0.7 && (!bestModelMatch || score > bestModelMatch.score)) {
        bestModelMatch = { model: mod, score };
      }
    }

    if (bestModelMatch) {
      return {
        isDuplicate: true,
        match: {
          make: bestMakeMatch.make.name,
          model: bestModelMatch.model.name,
          confidence: Math.round((bestMakeMatch.score + bestModelMatch.score) * 50),
        },
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    console.warn('[VehicleService] Duplicate check skipped due to error:', err);
    return { isDuplicate: false };
  }
}

