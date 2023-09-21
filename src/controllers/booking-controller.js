const axios = require('axios');

const { StatusCodes } = require('http-status-codes');

const { BookingService } = require('../services/index');
const { formattedDate } = require("../utils/time_helper");

const bookingService = new BookingService();

class BookingController {
constructor() {
        
    }

async create (req, res) {
    try {
        const response = await bookingService.createBooking(req.body);
        return res.status(StatusCodes.OK).json({
            message: 'Successfully completed booking',
            success: true,
            err: {},
            data: response
        })
    } catch (error) {
        return res.status(error.statusCode).json({
            message: error.message,
            success: false,
            err: error.explanation,
            data: {}
        });
    }
}
async publish(req, res) {
    try {
        // Create the email message
        const emailMessage = {
            subject: 'Booking Confirmation',
            content: `Dear User, 
                We are delighted to confirm your recent booking with AeroJet Express. Your reservation has been successfully processed.
                Safe travels!
                Best regards,`,
            recepientEmail: 'ayush2992@gmail.com',
            notificationTime: formattedDate,
        };

        // Call the sendMessageToQueue method with the email message
        const response = await bookingService.sendMessageToQueue(emailMessage);

        if (response.success) {
            return res.status(StatusCodes.OK).json({
                message: 'Successfully completed sending emails',
                success: true,
                err: {},
                data: response.data,
            });
        } else {
            // Handle the case where sending the email failed
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                message: 'Failed to send emails',
                success: false,
                err: 'Email sending failed',
                data: {},
            });
        }
    } catch (error) {
        // Handle unexpected errors
        console.error('Error:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Internal server error',
            success: false,
            err: 'Internal server error',
            data: {},
        });
    }
}

}
module.exports = BookingController;