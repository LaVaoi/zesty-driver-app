import nodemailer from 'nodemailer';

// Create a transporter object using SMTP transport
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail', // or your email service
    auth: {
      user: process.env.EMAIL_USER, // your email
      pass: process.env.EMAIL_PASS, // your email password or app password
    },
  });
};

// Send new order notification email to restaurant
export const sendNewOrderEmail = async (orderDetails, restaurantSettings) => {
  try {
    if (!restaurantSettings.restaurant_email) {
      console.log('No restaurant email configured, skipping email notification');
      return;
    }

    const transporter = createTransporter();
    
    const emailContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
              <h1 style="color: #333; margin: 0;">🍽️ New Order Alert!</h1>
              <h2 style="color: #666; margin: 5px 0;">${restaurantSettings.restaurant_name || 'Restaurant'}</h2>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #333; margin-top: 0;">Order Details</h3>
              <p><strong>Order Number:</strong> #${orderDetails.order_number}</p>
              <p><strong>Date:</strong> ${new Date(orderDetails.created_at).toLocaleString()}</p>
              <p><strong>Customer:</strong> ${orderDetails.customer_name || 'Guest'}</p>
              ${orderDetails.customer_phone ? `<p><strong>Phone:</strong> ${orderDetails.customer_phone}</p>` : ''}
              ${orderDetails.delivery_address ? `<p><strong>Delivery Address:</strong> ${orderDetails.delivery_address}</p>` : ''}
              <p><strong>Payment Status:</strong> ${orderDetails.payment_status}</p>
              <p><strong>Total Amount:</strong> ${orderDetails.final_price} MAD</p>
            </div>
            
            ${orderDetails.items && orderDetails.items.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333;">Order Items</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Item</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Quantity</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderDetails.items.map(item => `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name || 'Product'}</td>
                      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${(item.price_per_unit || item.price || 0)} MAD</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #666; font-size: 14px;">Please check your admin panel for more details and to manage this order.</p>
              <p style="color: #999; font-size: 12px; margin-top: 10px;">This is an automated notification from ${restaurantSettings.restaurant_name || 'Restaurant'}.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: restaurantSettings.restaurant_email,
      subject: `🍽️ New Order #${orderDetails.order_number} - ${restaurantSettings.restaurant_name || 'Restaurant'}`,
      html: emailContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ New order email sent to ${restaurantSettings.restaurant_email}`);
    
  } catch (error) {
    console.error('❌ Error sending new order email:', error);
    // Don't throw the error, just log it, as email failure shouldn't break the order creation
  }
};

// Test email configuration
export const testEmailConfigurationMailer = async (testEmail) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: testEmail,
      subject: '🧪 Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✅ Email Configuration Test Successful!</h2>
          <p>Your restaurant email notifications are working correctly.</p>
          <p>This is a test email from your restaurant ordering system.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Test email sent successfully' };
    
  } catch (error) {
    console.error('❌ Email configuration test failed:', error);
    return { success: false, message: error.message };
  }
};
