const axios = require('axios');

const { formattedDate } = require("../utils/time_helper");
const { createChannel, publishMessage } = require("../utils/messageQueue");
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
                content: 
                   `Dear Customers, 
                    We are delighted to confirm your recent booking with AeroJet Express. Your reservation has been successfully processed.
                Safe travels!
                Best regards,`,
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