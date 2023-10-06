import { readFile } from "fs/promises";
import { parse } from "csv-parse/sync";

// Types below represents the data within each csv file

export type Stop = {
    stop_id: string;
    stop_code?: string;
    stop_name?: string;
    stop_desc?: string;
    stop_lat?: number;
    stop_lon?: number;
    zone_id?: string;
    stop_url?: string;
    location_type?: 0 | 1 | 2 | 3 | 4;
    parent_station?: string;
    platform_code?: string;

}

export type Stop_Time = {
    trip_id: string;
    arrival_time?: string;
    departure_time?: string;
    stop_id: string;
    stop_sequence: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12; 
    pickup_type?: 0 | 1;
    drop_off_type?: 0 | 1;

}

export type Trip = {
    route_id: string;
    service_id: string; 
    trip_id: string;
    trip_headsign?: string;
    direction_id?: 0 | 1;
    block_id?: string;
    shape_id?: string;

}

export type Routes = {
    route_id: string;
    route_short_name?: string;
    route_long_name?: string;
    route_desc?: string;
    route_type: string;
    route_url?: string;
    route_color?: string;
    route_text_color?: string;

}

export type Calendar = {
    service_id: string;
    monday: 0 | 1;
    tuesday: 0 | 1;
    wednesday: 0 | 1;
    thursday: 0 | 1;
    friday: 0 | 1;
    saturday: 0 | 1;
    sunday: 0 | 1;
    start_date: string;
    end_date: string;

}

export type Calendar_Dates = {
    service_id: string;
    date: string;
    exception_type: 1 | 2;

}

/**
 * Function to filter all the static data, and return array of static data
 * that is relevant to the UQ Lakes Station
 * 
 * @returns { Stop[], Stop_Time[], Trip[], Route[], Calendar[] } Relevant data
 */

export async function getStatic() {

    /** 
     * This function will read in all data from 'stops.txt', and return all
     * stops which share the parent station of UQ Lakes Station
     * 
     * @returns {Stop[]} uqStop - Array of type 'Stop', all stops sharing the 'place_uqlksa' parent station
    */

    async function getStop(): Promise<Stop[]> {

        const stops = await readFile("static-data/stops.txt", "utf-8");
        const parsedStops = parse(stops, {columns: true}) as Stop[];
        const uqStop = parsedStops.filter((stop) => { // Filters for entries which share parent station
            return stop.parent_station == 'place_uqlksa'});

        return uqStop;

    }

    /**
     * Function to retrieve all the stops from stop_times.txt and filter for
     * stop times relevant to the UQ Lakes station
     * 
     * @param {Stop[]} stops - Array of Stop[] objects
     * @returns {Stop_Time[]} uqStopTimes - an array of Stop_Time objects
     */

    async function getStopTimes(stops: Stop[]): Promise<Stop_Time[]> {

        const stopTimes = await readFile("static-data/stop_times.txt", "utf-8");
        const parsedStopTimes = parse(stopTimes, {columns: true}) as Stop_Time[];
        const allStopIds = stops.map((stop) => stop.stop_id);
        const uqStopTimes = parsedStopTimes.filter((stopTime) => allStopIds.includes(stopTime.stop_id));

        return uqStopTimes;

    }

    /**
     * This function will retrieve and filter all data from trips.txt
     * and return trips relevant to the UQ Lakes station
     * 
     * @param {Stop_Time[]} stopTimes - array of stop times relevant to UQ Lakes Station
     * @returns {Trip[]} uqTrips - array of trips relevant to UQ Lakes Station 
     */

    async function getTrips(stopTimes: Stop_Time[]): Promise<Trip[]> {

        const trips = await readFile("static-data/trips.txt", "utf-8");
        const parsedTrips = parse(trips, {columns: true}) as Trip[];
        const stopTimeTripIDs = stopTimes.map((stopTime) => stopTime.trip_id);
        const uqTrips = parsedTrips.filter((trip) => stopTimeTripIDs.includes(trip.trip_id));
        
        return uqTrips;

    }

    /**
     * This function will retrieve and filter all data from routes.txt
     * and return all routes relevant to UQ Lakes station 
     * 
     * @param {Trip[]} trips - array of trips relevant to UQ Lakes station
     * @returns {Routes[]} uqRoutes - array of routes relevant to UQ Lakes station
     */

    async function getRoute(trips: Trip[]) {

        const routes = await readFile("static-data/routes.txt", "utf-8");
        const parsedRoutes = parse(routes, {columns: true}) as Routes[];
        const routeIds = trips.map(trip => trip.route_id);
        const uqRoutes = parsedRoutes.filter((route) => routeIds.includes(route.route_id));

        return uqRoutes;
        
    }

    /**
     * This function will retrive and filter all data from calendar.txt
     * and return all calendar data that is relevant 
     * 
     * @param {Trip[]} trips - array of trips relevant to UQ Lakes station
     * @returns {Calendar[]} uqCalendar - array of routes relevant to UQ Lakes station
     * 
     */

    async function getCalender(trips: Trip[]) {

        const calenders = await readFile("static-data/calendar.txt", "utf-8");
        const parsedCalendar = parse(calenders, {columns: true}) as Calendar[];
        const UQServiceIDs = trips.map((trip) => trip.service_id);
        const uqCalendar = parsedCalendar.filter((calendar) => UQServiceIDs.includes(calendar.service_id));

        return uqCalendar;
    }


    // Call each function and link the data together
    const lakesStop: Stop[] = await getStop();
    const lakesStopTime: Stop_Time[] = await getStopTimes(lakesStop);
    const lakesTrips: Trip[] = await getTrips(lakesStopTime);
    const lakesRoutes: Routes[] = await getRoute(lakesTrips);
    const lakesCalendars: Calendar[] = await getCalender(lakesTrips);
    
    // Returns an object with all the filtered static data
    return { lakesStop, lakesStopTime, lakesTrips, lakesRoutes, lakesCalendars };

}

getStatic();