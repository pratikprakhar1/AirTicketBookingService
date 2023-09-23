const axios = require('axios');

const { formattedDate } = require("../utils/time_helper");
const { createChannel, publishMessage  } = require("../utils/messageQueue");
const { confirmation } = require("../utils/confirmation");
const { cancellation } = require("../utils/cancellation");
const { REMINDER_BINDING_KEY } = require("../config/serverConfig");

const { BookingRepository } = require('../repository/index');
const { FLIGHT_SERVICE_PATH } = require('../config/serverConfig');
const { FLIGHT_AUTH_PATH } = require('../config/serverConfig');
const { ServiceError } = require('../utils/errors');



class BookingService {
    constructor() {
        this.bookingRepository = new BookingRepository();
    }

    async createBooking(data) {
        try {

            const userId = data.userId;
            const getUserRequestURL = `${FLIGHT_AUTH_PATH}/api/v1/user/${userId}`;
            const Userdetails = await axios.get(getUserRequestURL);
            const Userdata = Userdetails.data.data;
            let IdOfUser = Userdata.id;
            let EmailOfUser = Userdata.email;
            if(IdOfUser == null){
                throw new ServiceError('Invalid user');
            }

            

            const flightId = data.flightId;
            const getFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${flightId}`;
            const response = await axios.get(getFlightRequestURL);
            const flightData = response.data.data;
            let priceOfTheFlight = flightData.price;


            if (data.noOfSeats <= 0) {
                throw new ServiceError('Invalid number of seats', 'Number of seats to book must be greater than 0');
            }


            if(data.noOfSeats > flightData.totalSeats) {
                throw new ServiceError('Something went wrong in the booking process', 'Insufficient seats in the flight');
            }


            const totalCost = priceOfTheFlight * data.noOfSeats;
            //with ...data we can destructure data to add totalCost property
            const bookingPayload = {...data, totalCost};


            const booking = await this.bookingRepository.create(bookingPayload);
            const updateFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${booking.flightId}`;
            //console.log(updateFlightRequestURL);
            await axios.patch(updateFlightRequestURL, {totalSeats: flightData.totalSeats - booking.noOfSeats});


            const finalBooking = await this.bookingRepository.update(booking.id, {status: "Booked"});
            if(finalBooking.dataValues.status == 'Booked'){
                const emailMessage = {
                    subject: 'Booking Confirmation (AeroJet Express)',
                    content: confirmation(totalCost, data.noOfSeats),
                    recepientEmail: EmailOfUser,
                    notificationTime: formattedDate,
                };

                
                
    
            // Call the sendMessageToQueue method with the email message
            return await this.sendMessageToQueue(emailMessage);
        }


        } catch (error) { 
            //console.log(error);
            if(error.name == 'RepositoryError' || error.name == 'ValidationError') {
                throw error;
            }
            throw new ServiceError();
        }
    }

    async cancelBooking(data) {
        try {
            // Fetch the booking by its ID
            const booking = await this.bookingRepository.findById(data.bookingId);
            if (!booking) {
                throw new ServiceError('Booking not found', 'The booking with the specified ID does not exist');
            }

            // Check if the booking is already canceled
            if (booking.status === 'Canceled') {
                throw new ServiceError('Booking already canceled', 'The booking has already been canceled');
            }
            
            // Check if the departure time is within 3 hours from now
            const getFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${booking.flightId}`;
            const flight = await axios.get(getFlightRequestURL);
            const flightData = flight.data.data;
            const currentTime = new Date();

            const departureTime = new Date(flightData.departureTime);

            // Calculate the time 3 hours before departure
            const threeHoursBeforeDeparture = new Date(departureTime);
            threeHoursBeforeDeparture.setHours(departureTime.getHours() - 3);

            // Check if the current time is after three hours before departure
            if (currentTime > threeHoursBeforeDeparture) {
                throw new ServiceError('Cancellation not allowed', 'Cancellation is not allowed within 3 hours of departure');
            }

            // Updating the booking status to 'Canceled'
            const updatedBooking = await this.bookingRepository.update(data.bookingId, { status: 'Cancelled' });
            // Restored the seats by adding the booked seats back to the flight's total seats
            const updatedFlight = await this.updateFlightSeats(booking.flightId, booking.noOfSeats);
            console.log(updatedBooking);

            const getUserRequestURL = `${FLIGHT_AUTH_PATH}/api/v1/user/${booking.userId}`;
            const Userdetails = await axios.get(getUserRequestURL);
            const Userdata = Userdetails.data.data;
            let EmailOfUser = Userdata.email;
            const cancellationEmailMessage = {
                subject: 'Booking Cancellation (AeroJet Express)',
                content: cancellation(booking.id, booking.totalCost),
                recepientEmail: EmailOfUser,
                notificationTime: formattedDate, 
            };
            // Call the sendMessageToQueue method with the email message
            await this.sendMessageToQueue(cancellationEmailMessage);
            return {
                success: true,
                message: 'Booking canceled successfully',
                data: updatedBooking,
                restoredSeats: updatedFlight.totalSeats,
            };
        } catch (error) {
            if (error.name === 'RepositoryError' || error.name === 'ValidationError' || error instanceof ServiceError) {
                throw error;
            }
            throw new ServiceError();
        }
    }

    async updateFlightSeats(flightId, seatsToAdd) {
        try {
            // Fetch the flight by its ID
            const flight = await axios.get(`${FLIGHT_SERVICE_PATH}/api/v1/flights/${flightId}`);
            const flightData = flight.data.data;

            // Calculate the updated total seats
            const updatedTotalSeats = flightData.totalSeats + seatsToAdd;

            // Update the flight's total seats
            await axios.patch(`${FLIGHT_SERVICE_PATH}/api/v1/flights/${flightId}`, { totalSeats: updatedTotalSeats });

            return { totalSeats: updatedTotalSeats };
        } catch (error) {
            throw new ServiceError('Flight update failed', 'Failed to update the flight\'s total seats');
        }
    }


    async sendMessageToQueue(emailMessage) {
        try {
            const channel = await createChannel();
            const payload = {
                data: emailMessage, // Pass the emailMessage directly
                service: 'CREATE_TICKET'
            };
    
            publishMessage(channel, REMINDER_BINDING_KEY, JSON.stringify(payload));
            return {
                success: true,
                data: payload.success
            };
        } catch (error) {
            return {
                success: false,
                error
            };
        }
    }
    
}

module.exports = BookingService;