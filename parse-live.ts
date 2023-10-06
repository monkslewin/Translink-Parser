import fetch from 'node-fetch';
import fs from "fs/promises";
import { Routes } from './parse-static.js';


export type Trip = {
    tripId: string;
    routeId: string;
    startTime: string;
    startDate: string;
    scheduleRelationship: "SCHEDULED" | "SKIPPED" | "NO_DATA" | "UNSCHEDULED";

}

export type Vehicle = {
    id: string;

}

export type ArrivalDeparture = {
    delay: number;
    time: string;
    uncertainty: number;

}

export type StopTimeUpdate = {
    stopSequence: number;
    stopId: string;
    arrival: ArrivalDeparture;
    departure: ArrivalDeparture;
    scheduleRelationship: "SCHEDULED" | "SKIPPED" | "NO_DATA" | "UNSCHEDULED";

}

export type Trip_Update = {
    trip: Trip;
    vehicle: Vehicle;
    stopTimeUpdate: StopTimeUpdate[];
    timestamp: string;

}

export type Entity = {
    id: string;
    tripUpdate: Trip_Update;
}

export type GtfsRealtimeData = {
    header: {
        gtfsRealtimeVersion: string;
        incrementality: string;
        timestamp: string;
    };
    entity: Entity[];

}

export type Position = {
    latitude: number;
    longitude: number;

}

export type Location_Trip = {
    tripId: string;
    routeId: string;

}

export type Location_Vehicle = {
    id: string;
    label: string;

}

export type Vehicle_Position = {
    trip: Location_Trip;
    vehicle: Location_Vehicle;
    position: Position;
    stopID: string;
    current_status: "IN_TRANSIT_TO" | "STOPPED_AT";
    timestamp: string;

}

type Location_Entity = {
    id: string;
    vehicle: Vehicle_Position;

}

type GTFS_Real_Time_Location = {
    header: {
        gtfsRealtimeVersion: string;
        incrementality: string;
        timestamp: string;
    };
    entity: Location_Entity[];

}

type Translation = {
    text: string;
    language: string;

}

type Active_Period = {
    start: string;

}

type informedEntity = {
    routeId: string;

}

type url = {
    translation: Translation[];

}

type Alert = {
    active_period: Active_Period;
    informedEntity: informedEntity[];
    cause: string;
    effect: string;
    url: url;
    header_text: Translation;
    description_text: Translation;

}

type Alert_Entity = {
    id: string;
    alert: Alert;

}

type GTFS_Real_Time_Alert = {
    header: {
        gtfsRealtimeVersion: string;
        incrementality: string;
        timestamp: string;
  };
    entity: Alert_Entity[];
}


const CACHE_DURATION = 300_000; // Five minutes in milliseconds

/**
 * Function to write data to the cache files 
 * 
 * @param {string} filename - path to cache data file
 * @param data 
 */

async function writeCache(filename: string, data: any) {
  try {
      await fs.writeFile(filename, JSON.stringify({timestamp: Date.now(), data}), 'utf-8');
  } catch (error) {
      console.log(error);
  }
}

/**
 * Attempts to read a cache file and updates it if the file is older than 
 * five minutes
 * 
 * @param {string} filename - Path to cache data file
 * @returns {null} - If there is an error with the cache, null is returned
 */

async function readCache(filename: string) {
  try {
      const rawData = await fs.readFile(filename, 'utf-8');
      const cachedData = JSON.parse(rawData);

        // Ensures the cache is not older than five minutes
      if (Date.now() - cachedData.timestamp < CACHE_DURATION) {
          return cachedData.data;
      }

      // Cache is older than 5 minutes

      return null;
  } catch (error) {
      // If there's an error reading the file or if the file doesn't exist
      return null;
  }
}

/**
 * Function which retrieves all relevant data from the API
 * 
 * @param {Routes[]} lakesRoutes - array of the UQ Lakes station routes
 * @returns {{tripUpdates, vehiclePosition}} - object with API data
 * 
 */

export async function getAPIData(lakesRoutes: Routes[]) {

    /**
     * Function which retrieves all data from an API
     * 
     * @param {string} url - url to API 
     * @returns {string} decoded - string representation of the data
     */
    async function getData(url: string) {
        const unfilteredData = await fetch(url); // Fetches data from API 
        const buffer: ArrayBuffer = await unfilteredData.arrayBuffer(); // Reads raw data as an ArrayBuffer
        const decoded: string = new TextDecoder().decode(buffer); // Decodes the buffer data into a string
        return decoded;

    }

    /**
     * Function to get the relevant trip updates (important for vehicle arrival time)
     * 
     * @param {Routes[]} uqRoutes - array of routes relevant to UQ Lakes station
     * @returns {Trip_Update[]} - Trip updates relevant to UQ busses 
     * 
     */

    async function getUQTripUpdates(uqRoutes: Routes[]): Promise<Trip_Update[]> {
        let cacheData = await readCache('cached-data/trip-updates-cache.json');
        // If there is any cache data, return cached data
        if (cacheData) {
          return cacheData;
        }

        const rawTripUpdates = await getData('http://127.0.0.1:5343/gtfs/seq/trip_updates.json');
        const jsonified: GtfsRealtimeData = JSON.parse(rawTripUpdates);
        const tripUpdates = jsonified.entity.map((tripUpdate) => tripUpdate.tripUpdate);
        const routeIDs = uqRoutes.map((route) => route.route_id);
        const uqTripUpdates = tripUpdates.filter(tripUpdate => tripUpdate.trip.routeId && routeIDs.includes(tripUpdate.trip.routeId));

        await writeCache('cached-data/trip-updates-cache.json', uqTripUpdates);
        return uqTripUpdates;

    }

    /**
     * Function to retrieve all vehicle position data from the API. This data
     * is then filtered to only contain relevant records 
     * 
     * @param {Routes[]} uqRoutes - array of the routes relevant to UQ Lakes station
     * @returns {Vehicle_Position[]} uqVehicleLocations - array of the vehicle 
     * locations relevant to busses inbound to UQ Lakes station
     */

    async function getUQVehiclePosition(uqRoutes: Routes[]): Promise<Vehicle_Position[]> {
      let cacheData = await readCache('cached-data/alerts-cache.json');

      if (cacheData) {
        return cacheData;
      }

        const rawVehicleLocation = await getData('http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json');
        const jsonified: GTFS_Real_Time_Location = JSON.parse(rawVehicleLocation);
        const vehicleLocations = jsonified.entity.map((vehicle) => vehicle.vehicle);
        const uqVehicleLocations = vehicleLocations.filter((vehicleLocation) => uqRoutes.some((uqRoute) => uqRoute.route_id == vehicleLocation.trip.routeId));

        await writeCache('cached-data/vehicle-locations-cache.json', uqVehicleLocations);
        return uqVehicleLocations;

    }

    const tripUpdates =  await getUQTripUpdates(lakesRoutes);
    const vehiclePosition = await getUQVehiclePosition(lakesRoutes);

    return { tripUpdates, vehiclePosition } // Returns object of API data

}
