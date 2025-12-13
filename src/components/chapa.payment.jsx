const Chapapay = new ChapaCheckout({
    publicKey: 'YOUR_PUBLIC_KEY_HERE',
    amount: '100',
    currency: 'ETB',
    availablePaymentMethods: ['telebirr', 'cbebirr', 'ebirr', 'mpesa', 'chapa'],
    customizations: {
        buttonText: 'Pay Now',
        styles: `
            .chapa-pay-button { 
                background-color: #4CAF50; 
                color: white;
            }
        `
    },
    callbackUrl: 'https://yourdomain.com/callback',
    returnUrl: 'https://yourdomain.com/success',
});

Chapapay.initialize('chapa-inline-form');