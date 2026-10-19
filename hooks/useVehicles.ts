import { useVehicleContext } from '@/contexts/VehicleContext';
import type { CreateVehicleInput } from '@/services/vehicles';
import type { Vehicle } from '@/types/database';

export interface UseVehiclesResult {
  vehicles: Vehicle[];
  primaryVehicle: Vehicle | null;
  activeVehicleId: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addVehicle: (input: Omit<CreateVehicleInput, 'userId'>) => Promise<Vehicle>;
  setPrimary: (vehicleId: string) => Promise<void>;
  switchPrimary: (vehicleId: string) => Promise<void>;
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

/**
 * useVehicles convenience hook that connects directly to VehicleContext
 * ensuring single source of truth across all screens.
 */
export function useVehicles(): UseVehiclesResult {
  const ctx = useVehicleContext();
  return {
    ...ctx,
    setPrimary: ctx.switchPrimary,
  };
}
