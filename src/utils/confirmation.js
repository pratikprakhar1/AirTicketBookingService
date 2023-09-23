function confirmation(totalCost, noOfSeats) {
    return `
Dear Customer, 
We are pleased to confirm your recent booking with AeroJet Express.
Booking Details:
                - Total Amount Paid: $${totalCost}
                - Number of Seats Booked: ${noOfSeats}
Your reservation has been successfully processed.
Safe travels!
Best regards,
    `;
}

module.exports = { confirmation };