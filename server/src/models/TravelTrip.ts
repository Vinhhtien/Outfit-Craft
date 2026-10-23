import { Schema, model, Document, Types } from 'mongoose';

export const TRIP_TYPES = ['leisure', 'beach', 'business', 'trekking', 'winter', 'other'] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const TRAVEL_ITEM_CATEGORIES = [
  'top',
  'bottom',
  'outerwear',
  'dress',
  'shoes',
  'bag',
  'accessory',
  'personal',
  'documents',
  'electronics',
  'medical',
] as const;
export type TravelItemCategory = (typeof TRAVEL_ITEM_CATEGORIES)[number];

export interface ITravelItem {
  _id: Types.ObjectId;
  clothingItem?: Types.ObjectId;
  name: string;
  category: TravelItemCategory;
  imageUrl?: string;
  quantity: number;
  isPacked: boolean;
  note?: string;
}

export interface ITripWeather {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  condition: string;
  description: string;
  icon: string;
  isRaining: boolean;
  fetchedAt: Date;
}

export interface ITravelTrip extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  tripType: TripType;
  notes?: string;
  weatherSnapshot?: ITripWeather;
  items: ITravelItem[];
  createdAt: Date;
  updatedAt: Date;
}

const travelItemSchema = new Schema<ITravelItem>(
  {
    clothingItem: { type: Schema.Types.ObjectId, ref: 'ClothingItem' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: TRAVEL_ITEM_CATEGORIES, default: 'personal' },
    imageUrl: { type: String, default: '' },
    quantity: { type: Number, default: 1, min: 1, max: 99 },
    isPacked: { type: Boolean, default: false },
    note: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

const tripWeatherSchema = new Schema<ITripWeather>(
  {
    city: { type: String, required: true },
    temp: { type: Number, required: true },
    feelsLike: { type: Number, required: true },
    humidity: { type: Number, default: 60 },
    condition: { type: String, default: 'Clear' },
    description: { type: String, default: 'Trời quang' },
    icon: { type: String, default: '01d' },
    isRaining: { type: Boolean, default: false },
    fetchedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const travelTripSchema = new Schema<ITravelTrip>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    destination: { type: String, required: true, trim: true, maxlength: 100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    tripType: { type: String, enum: TRIP_TYPES, default: 'leisure' },
    notes: { type: String, maxlength: 500 },
    weatherSnapshot: { type: tripWeatherSchema },
    items: { type: [travelItemSchema], default: [] },
  },
  { timestamps: true }
);

travelTripSchema.index({ owner: 1, startDate: 1 });

export const TravelTrip = model<ITravelTrip>('TravelTrip', travelTripSchema);
