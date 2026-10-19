import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export type AvatarSource = 'car' | 'custom' | 'initial';
const AVATAR_SOURCE_STORAGE_KEY = '@slipstream_avatar_source';

export interface VehicleContextValue {
  vehicles: Vehicle[];
  primaryVehicle: Vehicle | null;
  activeVehicleId: string | null;
  isLoading: boolean;
  error: string | null;
  avatarSource: AvatarSource;
  setAvatarSource: (source: AvatarSource) => Promise<void>;
  refresh: () => Promise<void>;
  switchPrimary: (vehicleId: string) => Promise<void>;
  addVehicle: (input: Omit<CreateVehicleInput, 'userId'>) => Promise<Vehicle>;
  removeVehicle: (vehicleId: string) => Promise<void>;
  uploadPhoto: (vehicleId: string, localUri: string) => Promise<string>;
  updateOdometer: (vehicleId: string, odometerKm: number) => Promise<void>;
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
  attachDrives: (vehicleId: string, tripIds?: string[]) => Promise<number>;
  moveTrips: (fromVehicleId: string, toVehicleId: string) => Promise<number>;
}

const VehicleContext = createContext<VehicleContextValue | null>(null);

export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarSource, setAvatarSourceState] = useState<AvatarSource>('car');

  // Load avatar source preference from AsyncStorage
  useEffect(() => {
    async function loadAvatarPref() {
      try {
        const stored = await AsyncStorage.getItem(AVATAR_SOURCE_STORAGE_KEY);
        if (stored === 'car' || stored === 'custom' || stored === 'initial') {
          setAvatarSourceState(stored);
        }
      } catch (err) {
        console.warn('[VehicleContext] Error reading avatar preference:', err);
      }
    }
    loadAvatarPref();
  }, []);

  const setAvatarSource = useCallback(async (source: AvatarSource) => {
    try {
      setAvatarSourceState(source);
      await AsyncStorage.setItem(AVATAR_SOURCE_STORAGE_KEY, source);
    } catch (err) {
      console.error('[VehicleContext] Error saving avatar preference:', err);
    }
  }, []);

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
      console.error('[VehicleContext] Error loading vehicles:', err);
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

  const activeVehicleId = useMemo(() => {
    return primaryVehicle?.id ?? null;
  }, [primaryVehicle]);

  const switchPrimary = useCallback(
    async (vehicleId: string): Promise<void> => {
      if (!user) return;

      // Optimistic state update
      setVehicles((prev) =>
        prev.map((v) => ({
          ...v,
          is_primary: v.id === vehicleId,
        })),
      );

      try {
        await setPrimaryService(user.id, vehicleId);
      } catch (err) {
        await loadVehicles();
        throw err;
      }
    },
    [user, loadVehicles],
  );

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

  const removeVehicle = useCallback(
    async (vehicleId: string): Promise<void> => {
      if (!user) return;

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

  const attachDrives = useCallback(
    async (vehicleId: string, tripIds?: string[]): Promise<number> => {
      const count = await attachDrivesToVehicle(vehicleId, tripIds);
      await loadVehicles();
      return count;
    },
    [loadVehicles],
  );

  const moveTrips = useCallback(
    async (fromVehicleId: string, toVehicleId: string): Promise<number> => {
      const count = await moveTripsService(fromVehicleId, toVehicleId);
      await loadVehicles();
      return count;
    },
    [loadVehicles],
  );

  const value = useMemo<VehicleContextValue>(
    () => ({
      vehicles,
      primaryVehicle,
      activeVehicleId,
      isLoading,
      error,
      avatarSource,
      setAvatarSource,
      refresh: loadVehicles,
      switchPrimary,
      addVehicle,
      removeVehicle,
      uploadPhoto,
      updateOdometer,
      updateVehicleDetails,
      attachDrives,
      moveTrips,
    }),
    [
      vehicles,
      primaryVehicle,
      activeVehicleId,
      isLoading,
      error,
      avatarSource,
      setAvatarSource,
      loadVehicles,
      switchPrimary,
      addVehicle,
      removeVehicle,
      uploadPhoto,
      updateOdometer,
      updateVehicleDetails,
      attachDrives,
      moveTrips,
    ],
  );

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicleContext(): VehicleContextValue {
  const context = useContext(VehicleContext);
  if (!context) {
    throw new Error('useVehicleContext must be used within a VehicleProvider');
  }
  return context;
}
