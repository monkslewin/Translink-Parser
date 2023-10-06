import { Calendar, Routes, Stop_Time, Trip, getStatic } from './parse-static.js';
import { Trip_Update, Vehicle_Position } from './parse-live.js';
import { getAPIData } from './parse-live.js';
import promptSync from 'prompt-sync';

const prompt = promptSync()

type Time = { 
    hours: string;
    minutes: string;

}

/**
 * Function which welcomes user and performs necessary tasks
 * to display the final table
 * 
 */

async function welcome() {
    console.log("Welcome to the UQ Lakes station bus tracker!");
    const busDate = getDate(); 
    const busTime = getTime();
    const busRoute = await getBus();
    const filteredData = filterStaticData(busRoute, busDate, busTime)

}

/**
 * Function to determine if the user wants to search for a bus again
 * 
 */

function goAgain() {
    const validDeclines: string[] = ["n", "no"];
    const validAccepts: string[] = ["yes", "y"];

    // If the user enters a valid input, the appropriate statement is executed
    const input: string = prompt("Would you like to search again?")

    if (validDeclines.includes(input)) {
        process.exit(0);

    } else if (validAccepts.includes(input)) {
        welcome();

    } else {
        console.log("Please enter a valid option.");
        goAgain() // Recursively calls itself when the user's input is invalid
    }

}

/**
 * Function which retrieves the data from the user and validates it
 * 
 * @returns {Date} - validated Date object 
 * 
 */

function getDate(): Date {

    /**
     * Function to validate the time is of the correct format (HH:mm)
     * 
     * @param {string} input - string of the user's inputted time
     * @returns {boolean} - Status of the input
     * 
     */

    function validateDateFormat(input: string): boolean {
        const isValid = /\d{4}-\d{2}-\d{2}/.test(input) // Determines if the date is in the expected format
 
        if (isValid) { // Returns true if the isValid variable is true
            return true;

        } else {
            return false;
        }

    }

    const date = prompt("What date will you depart UQ Lakes station by bus? ");

    // Determines if the user has entered a date of the correct format
    if (validateDateFormat(date)) {
        const myDate = new Date(date);
        const today = new Date();
        
        return myDate;

    } else {
        console.log("Incorrect date format. Please use YYYY-MM-DD");
        return getDate(); // Recursively calls itself til correct format

    }

}

/**
 * Function to validate the format of the inputted date
 * 
 * @returns {boolean} - whether the time is of valid format 
 */

function getTime() {

    function validateTimeFormat(input: string): boolean {
        const isValid = /^([0-1]?[0-9]|2[0-4]):([0-5][0-9])?$/.test(input);

        if (isValid) {
            return true;

        } else {
            return false;
        }

    }

    const input = prompt("What time will you depart UQ Lakes station by bus? ")

    if (validateTimeFormat(input)) {
        const [hours, minutes] = input.split(":") // Creates two variables hours and mintutes and assigns them accordingly
        const myTime: Time = {hours, minutes}; // Assigns a variable as custom type 'Time' 
        return myTime;

    } else {
        console.log("Incorrect time format. Please use HH:mm");
        return getTime();
    }

}

/**
 * Function to get the users wanted bus route 
 * 
 * @returns {Routes[]} - array of relevant routes
 */

async function getBus() {

    /**
     * Function to validate the user's inputted bus route is within
     * a specific range
     * 
     * @param {string} input - the user's inputted numerical value
     * @returns {boolean} - whether the input is valid 
     * 
     */

    function validateBusRoute(input: string): boolean {
        const isValid = /^([1-8])$/.test(input);
        if (isValid) {
            return true
        }
        return false
    }

    /**
     * 
     * @param {string} input - user's inputted numerical value
     * @returns {Routes[]} - array of the relevant routes  
     * 
     */
    function getUQRoute(input: string): Routes[] {   
        if (input == "1") { // If user selects 'Show all routes'
            return STATIC_DATA.lakesRoutes;
        } else {
            return [STATIC_DATA.lakesRoutes[parseInt(input)-2]]; // Indexes array of routes account for position changes
        }
    }
    
    /**
     * Retrieves the user's wanted route. Requires a numerical input which
     * represents a specific bus route 
     * 
     * @returns {Routes[]} - Routes that are relevant based on the input
     */

    function getBusRoute(): Routes[] {
        const bus = prompt("What Bus Route would you like to take? ")
        if (validateBusRoute(bus)) { // If the input is validated
            return getUQRoute(bus);
        } else {
            console.log("Please enter a valid option for a bus route. ");
            return getBusRoute(); // Recursively calls itself til valid input 

        }
    }

    return getBusRoute();

}

/**
 * Function which filters the static data to only include data which is relevant 
 * to the user's inputted time, date and bus route/s
 * 
 * @param {Routes[]} busRoute - array of bus routes  
 * @param {Date} date - the user's inputted date as a Date object  
 * @param {Time} time - The user's inputted time as a custom Time type 
 */

function filterStaticData(busRoute: Routes[], date: Date, time: Time) {

    function getArrivalTimes() {
        const active = getActiveTrips();
        const activeTrips = STATIC_DATA.lakesTrips.filter((trip) => active.includes(trip.service_id));
        const routeIDs = busRoute.map((route) => route.route_id);
        const relevantTrips = activeTrips.filter((trip) => routeIDs.includes(trip.route_id));
        const filteredTripIds = relevantTrips.map((trip) => trip.trip_id);

        // Filters all stopTimes to only include those with matching trip_Ids 
        // and then filters further based on arrival and departure time

        const filteredStopTimes = STATIC_DATA.lakesStopTime.filter(stopTime => filteredTripIds.includes(stopTime.trip_id))
        .filter(stopTime => {
            // Case where bus route ends at UQ Lakes Station
            if (!stopTime.departure_time) {
                return false;
            }

            // If the bus is in transit use its arrival time
            if (stopTime.arrival_time) {
                const arrivalTime = parseTime(stopTime.arrival_time);
                const arrivalInMins = convertTime(arrivalTime);
                const timeInMins = convertTime(time);
                const difference = arrivalInMins - timeInMins
                return difference >= 0 && difference <= 10;
            }

            // If the bus route begins at this stop, use its departure
            const departureTime = parseTime(stopTime.departure_time);
            const timeInMins = convertTime(time);
            const departueTimeInMins = convertTime(departureTime);
            const difference = departueTimeInMins - timeInMins; // Difference in minutes
        
            return difference >= 0 && difference <=10; // If it between 0 and 10 minutes
        });

        return filteredStopTimes;
    }

    /**
     * Function to retrieve all service IDs of bus routes that are running on the 
     * inputted day from the user 
     * 
     * @returns {string[]} - string of the active service IDs
     * 
     */

    function getActiveTrips() {
        const calender = STATIC_DATA.lakesCalendars;
        const activeCalender = calender.filter((entry) => dateAvailability(entry));
        let activeServices;
        switch (date.getDay()) {
            case 0: // Sunday
                activeServices = activeCalender.filter((entry) => entry.sunday == 1).map((entry) => entry.service_id);
                break;

            case 1: // Monday
                activeServices = activeCalender.filter((entry) => entry.monday == 1).map((entry) => entry.service_id);
                break;

            case 2: // Tuesday
                activeServices = activeCalender.filter((entry) => entry.tuesday == 1).map((entry) => entry.service_id);
                break;
            
            case 3: // Wednesday
                activeServices = activeCalender.filter((entry) => entry.wednesday == 1).map((entry) => entry.service_id);
                break;

            case 4: // Thursday
                activeServices = activeCalender.filter((entry) => entry.thursday == 1).map((entry) => entry.service_id);
                break;

            case 5: // Friday
                activeServices = activeCalender.filter((entry) => entry.friday == 1).map((entry) => entry.service_id);
                break;

            case 6: // Saturday
                activeServices = activeCalender.filter((entry) => entry.saturday == 1).map((entry) => entry.service_id);
                break;
            
            default: // case where there are no active services
                return []
        }
        return activeServices;
    }

    /**
     * Function to parse the dates from the calender and then ensure that
     * the user's inputted date falls within this timeframe 
     * 
     * @param {Calendar} entry - 
     * @returns {boolean} - whether the provided date falls within the given range
     */

    function dateAvailability(entry: Calendar) {
        const startDate = new Date(parseInt(entry.start_date.slice(0,4)), parseInt(entry.start_date.slice(4,6))-1, parseInt(entry.start_date.slice(6,8)));
        const endDate =  new Date(parseInt(entry.end_date.slice(0,4)), parseInt(entry.end_date.slice(4,6))-1, parseInt(entry.end_date.slice(6,8)));
        
        return date >= startDate && date <= endDate; // If the date is between these two values
    }

    /**
     * Function to retrieve all trip IDs from an array
     * 
     * @param {Stop_Time[]} data - array of all Stop_Time objects
     * @returns {string[]} - array of the trip IDs
     */

    function getTripIds(data: Stop_Time[]): string[] {
        return data.map((trip) => trip.trip_id);

    }

    const stopTimes = getArrivalTimes(); // Gets times for bus arrivals 
    
    const tableData = stopTimes.map(time => { // returns an array of the neccesary objects
        const associatedTrip = STATIC_DATA.lakesTrips.find(trip => trip.trip_id === time.trip_id);
        const associatedRoute = STATIC_DATA.lakesRoutes.find(route => route.route_id === associatedTrip?.route_id);

        return { // returns an object with the necessary details
            'Route Short Name': associatedRoute?.route_short_name,
            'Route Long Name': associatedRoute?.route_long_name,
            'Service ID': associatedTrip?.service_id,
            'Heading Sign': associatedTrip?.trip_headsign,
            'Scheduled Arrival Time': time.arrival_time || time.departure_time
        };
    });

    filterAPIData(date, getTripIds(stopTimes), tableData); 
    
}

/**
 * Function to retrieve and filter all API data 
 * 
 * @param {string[]} tripIds - array of the relevant trip IDs
 * @param table - the array of objects that contains the static table data
 */

async function filterAPIData(date: Date, tripIds: string[], table: { 'Route Short Name': string | undefined; 'Route Long Name': string | undefined; 'Service ID': string | undefined; 'Heading Sign': string | undefined; 'Scheduled Arrival Time': string | undefined; }[]) {
    const tableData = table;
    const rawTripUpdates = APIData.tripUpdates;
    const rawVehicleLocations = APIData.vehiclePosition;


    
    /**
     * Function to filter the trip updates by filtering for data that contains
     * one of the relevant trip IDs
     * 
     * @returns {Trip_Update[]} - array of trip updates that are relevant to the user's inputs
     */

    function filterTripUpdates() {
        return rawTripUpdates.filter((tripUpdate) => tripIds.includes(tripUpdate.trip.tripId));

    }

    /**
     * Function to filter the vehicle locations by filtering the data if it includes
     * one of the relevant trip IDs
     * 
     * @returns {Vehicle_Position[]} - array of Vehicle_Position objects
     */

    function filterVehicleLocations() {
        return rawVehicleLocations.filter((location) => tripIds.includes((location.trip.tripId)));

    }
    // Ensures live data is only shown if the inputted day is the current date
    if (todaysDate.getDay() == date.getDay() && todaysDate.getMonth() && date.getMonth()) {
        createFinalTable(date, filterTripUpdates(), filterVehicleLocations(), tableData);

    } else {
        createFinalTable(date, [], [], tableData);
    }
    

}

/**
 * Function to combine the static and API data to create the final table
 * 
 * @param {Trip_Update[]} filteredTripUpdates - array of filtered trip updates  
 * @param {Vehicle_Position[]} filteredVehicleLocation - array of filtered vehicle positions
 * @param tableData - table data with static data
 */

function createFinalTable(date: Date, filteredTripUpdates: Trip_Update[], filteredVehicleLocation: Vehicle_Position[], tableData: { 'Route Short Name': string | undefined; 'Route Long Name': string | undefined; 'Service ID': string | undefined; 'Heading Sign': string | undefined; 'Scheduled Arrival Time': string | undefined; }[]) {
    function getLiveArrival(tripUpdates: Trip_Update[]) {
        const stopIds = STATIC_DATA.lakesStop.map((stop) => stop.stop_id);
        
        return tripUpdates.map(update => {
            // Finding the first tripUpdate with the matching stop ID
            const matchingStop = update.stopTimeUpdate.find(data => stopIds.includes(data.stopId));
            
            // If there is an arrival time, create a new Date object
            if (matchingStop && matchingStop.arrival && matchingStop.arrival.time) {
                return new Date(parseInt(matchingStop.arrival.time)*1000); // Converts the given time to a Date object
            }
            return undefined; // if there is no arrival time available
        });
    }
    /**
     * Function to filter the vehicle positions to relevant vehicles inbound
     * to the Lakes station
     * 
     * @param {Trip_Update[]} tripUpdates - array of trip updates  
     * @returns {Vehicle_Position[]} position - an array of the vehicle positions
     */

    function getVehiclePosition(tripUpdates: Trip_Update[]) {
        const position =  tripUpdates.map((update) => {
            return APIData.vehiclePosition.find((position) => position.trip.tripId == update.trip.tripId);
        })
       
       return position;

    }
    const today = new Date();
    const liveArrivalTimes = getLiveArrival(filteredTripUpdates);
    const liveVehiclePositions = getVehiclePosition(filteredTripUpdates);

    // Creates final table through spreading original arrays
    const finalTable = tableData.map((arrival, index) => {
        return {
            ...arrival, // Spreads each row of the table to add a new element 
            'Live Arrival Time': (!liveArrivalTimes[index]) 
            ? 'No Live Data' 
            : `${liveArrivalTimes[index]?.getHours()}:${String(liveArrivalTimes[index]?.getMinutes()).padStart(2, '0')}:00`, // ensures correct format 
            'Live Vehicle Position': (!liveVehiclePositions[index])
            ? 'No Live Data'
            : `${liveVehiclePositions[index]?.position.latitude}, ${liveVehiclePositions[index]?.position.longitude}`
        };
    });

    console.table(finalTable);
    goAgain()

}

/**
 * Function which converts a Time object to minutes
 * 
 * @param {Time} time - time object in HH:mm
 * @returns {number} - time in minutes from 00:00
 */
 
function convertTime(time: Time): number {
    return parseInt(time.hours)*60 + parseInt(time.minutes);
}

/**
 *  Function which converts a string in the form HH:mm to a Time type 
 * 
 * @param {string} time - string representation of time of the form HH:mm
 * @returns {Time} - Returns object of custom type Time.
 * 
 */

function parseTime(time: string): Time {
    return {
        hours: time.substring(0, 2),
        minutes: time.substring(3, 5)
    };
}

const STATIC_DATA = await getStatic(); // Since the data does not change it is a global variable

const todaysDate = new Date();

const APIData = await getAPIData(STATIC_DATA.lakesRoutes);


/**
 * Function which handles the main loop of the game 
 * 
 * @param {boolean} status - whether the user wants to continue using the application
 */

function main(status = true) { // Default value of true so code runs when first ran
    if (status) {
        welcome()
    } else {
        console.log("Thanks for using the UQ Lakes station bus tracker!");
    }
}

main()