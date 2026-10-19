import snapshot from '../../data/rental-market.json';
import { validateRentalSnapshot } from '../lib/rental-market.ts';

validateRentalSnapshot(snapshot);
export const rentalSnapshot = snapshot;
