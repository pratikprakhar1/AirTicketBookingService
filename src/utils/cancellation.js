function cancellation(id,totalCost) {
    return`Dear Customer, 
    Your booking with AeroJet Express has been canceled successfully.
    Booking Details:
                    - Booking ID: ${id}
                    - Total Amount Refunded: $${totalCost}
    We apologize for any inconvenience caused.
    Safe travels!
    Best regards,`;
}

module.exports = { cancellation };