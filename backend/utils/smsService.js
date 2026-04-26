import { Vonage } from '@vonage/server-sdk';

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
});

export const sendVerificationSMS = async (phoneNumber, verificationCode) => {
  console.log('SMS Service - Phone:', phoneNumber, 'Code:', verificationCode);

  if (!phoneNumber) {
    console.error('Phone number is undefined or null');
    return false;
  }

  const message = `Your FoodGo verification code is: ${verificationCode}. Valid for 10 minutes.`;

  try {

    const response = await vonage.sms.send({
      from: "FoodGo",
      to: phoneNumber,
      text: message
    });

    console.log("📤 Vonage SMS Response:", response);
    console.log("✅ SMS sent successfully!");

    return true;

  } catch (error) {
    console.error("❌ Vonage SMS error:", error);
    return false;
  }
};
