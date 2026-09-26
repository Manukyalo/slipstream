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
  nickname?: string | null;
  isPrimary?: boolean;
  localPhotoUri?: string | null;
}

/**
 * Create a new vehicle in the user's garage.
 * If marked as primary or if this is the user's first vehicle,
 * unsets primary on all other vehicles for this user first.
 */
export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const { userId, make, model, year, nickname, isPrimary, localPhotoUri } = input;

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
    nickname: nickname?.trim() || null,
    is_primary: shouldBePrimary,
    photo_url: null,
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
 * Client-side resize and compression before uploading to Supabase Storage.
 * Max width 1024px, JPEG 80% compression.
 * Path: vehicle-photos/{userId}/{vehicleId}.jpg
 */
export async function uploadVehiclePhoto(
  userId: string,
  vehicleId: string,
  localUri: string,
): Promise<string> {
  // 1. Client-side resize and compression
  const manipulated = await manipulateAsync(
    localUri,
    [{ resize: { width: 1024 } }],
    { compress: 0.8, format: SaveFormat.JPEG },
  );

  // 2. Read as array buffer for reliable React Native binary upload
  const response = await fetch(manipulated.uri);
  const arrayBuffer = await response.arrayBuffer();

  // 3. Upload to Supabase Storage bucket scoped to user folder
  const storagePath = `${userId}/${vehicleId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('vehicle-photos')
    .upload(storagePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('[VehicleService] Photo upload failed:', uploadError.message);
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  // 4. Retrieve public URL with timestamp cache buster
  const { data: urlData } = supabase.storage
    .from('vehicle-photos')
    .getPublicUrl(storagePath);

  const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // 5. Update vehicle record with new photo_url
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
