import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import {
  createVehicle,
  deleteVehicle as deleteVehicleService,
  fetchUserVehicles,
  setPrimaryVehicle as setPrimaryService,
  uploadVehiclePhoto as uploadPhotoService,
  updateVehicleOdometer,
  attachDrivesToVehicle,
  updateVehicle as updateVehicleService,
  moveTripsToVehicle as moveTripsService,
  type CreateVehicleInput,
} from '@/services/vehicles';
import type { Vehicle } from '@/types/database';

export interface UseVehiclesResult {
  vehicles: Vehicle[];
  primaryVehicle: Vehicle | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addVehicle: (input: Omit<CreateVehicleInput, 'userId'>) => Promise<Vehicle>;
  setPrimary: (vehicleId: string) => Promise<void>;
  removeVehicle: (vehicleId: string) => Promise<void>;
  uploadPhoto: (vehicleId: string, localUri: string) => Promise<string>;
  updateOdometer: (vehicleId: string, odometerKm: number) => Promise<void>;
  attachDrives: (vehicleId: string, tripIds?: string[]) => Promise<number>;
  updateVehicleDetails: (
    vehicleId: string,
    updates: Partial<{
      nickname: string | null;
      odometer: number;
      make: string;
      model: string;
      year: number;
    }>,
  ) => Promise<void>;
  moveTrips: (fromVehicleId: string, toVehicleId: string) => Promise<number>;
}

export function useVehicles(): UseVehiclesResult {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    if (!user) {
      setVehicles([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await fetchUserVehicles(user.id);
      setVehicles(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load garage';
      setError(msg);
      console.error('[useVehicles] Error loading vehicles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const primaryVehicle = useMemo(() => {
    return vehicles.find((v) => v.is_primary) ?? vehicles[0] ?? null;
  }, [vehicles]);

  const addVehicle = useCallback(
    async (input: Omit<CreateVehicleInput, 'userId'>): Promise<Vehicle> => {
      if (!user) {
        throw new Error('User must be signed in to add a vehicle');
      }

      const newVehicle = await createVehicle({
        ...input,
        userId: user.id,
      });

      await loadVehicles();
      return newVehicle;
    },
    [user, loadVehicles],
  );

  const setPrimary = useCallback(
    async (vehicleId: string): Promise<void> => {
      if (!user) return;

      // Optimistic update
      setVehicles((prev) =>
        prev.map((v) => ({
          ...v,
          is_primary: v.id === vehicleId,
        })),
      );

      try {
        await setPrimaryService(user.id, vehicleId);
      } catch (err) {
        // Rollback on error
        await loadVehicles();
        throw err;
      }
    },
    [user, loadVehicles],
  );

  const removeVehicle = useCallback(
    async (vehicleId: string): Promise<void> => {
      if (!user) return;

      // Optimistic filter
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));

      try {
        await deleteVehicleService(user.id, vehicleId);
        await loadVehicles();
      } catch (err) {
        await loadVehicles();
        throw err;
      }
    },
    [user, loadVehicles],
  );

  const uploadPhoto = useCallback(
    async (vehicleId: string, localUri: string): Promise<string> => {
      if (!user) {
        throw new Error('User must be signed in to upload a photo');
      }

      const photoUrl = await uploadPhotoService(user.id, vehicleId, localUri);
      await loadVehicles();
      return photoUrl;
    },
    [user, loadVehicles],
  );

  const updateOdometer = useCallback(
    async (vehicleId: string, odometerKm: number): Promise<void> => {
      if (!user) return;
      await updateVehicleOdometer(user.id, vehicleId, odometerKm);
      await loadVehicles();
    },
    [user, loadVehicles],
  );

  const attachDrives = useCallback(
    async (vehicleId: string, tripIds?: string[]): Promise<number> => {
      const count = await attachDrivesToVehicle(vehicleId, tripIds);
      await loadVehicles();
      return count;
    },
    [loadVehicles],
  );

  const updateVehicleDetails = useCallback(
    async (
      vehicleId: string,
      updates: Partial<{
        nickname: string | null;
        odometer: number;
        make: string;
        model: string;
        year: number;
      }>,
    ): Promise<void> => {
      if (!user) return;
      await updateVehicleService(user.id, vehicleId, updates);
      await loadVehicles();
    },
    [user, loadVehicles],
  );

  const moveTrips = useCallback(
    async (fromVehicleId: string, toVehicleId: string): Promise<number> => {
      const count = await moveTripsService(fromVehicleId, toVehicleId);
      await loadVehicles();
      return count;
    },
    [loadVehicles],
  );

  return {
    vehicles,
    primaryVehicle,
    isLoading,
    error,
    refresh: loadVehicles,
    addVehicle,
    setPrimary,
    removeVehicle,
    uploadPhoto,
    updateOdometer,
    attachDrives,
    updateVehicleDetails,
    moveTrips,
  };
}
