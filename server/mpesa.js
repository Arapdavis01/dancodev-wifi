const axios = require('axios');
const config = require('./config');

class MpesaService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
  }

  async getToken() {
    if (this.token && this.tokenExpiry > Date.now()) {
      return this.token;
    }

    const auth = Buffer.from(
      `${config.mpesa.consumerKey}:${config.mpesa.consumerSecret}`
    ).toString('base64');

    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );

    this.token = response.data.access_token;
    this.tokenExpiry = Date.now() + 3500000; // ~58 minutes
    return this.token;
  }

  generatePassword() {
    const shortcode = config.mpesa.shortcode;
    const passkey = config.mpesa.passkey;
    const timestamp = this.getTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  getTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  async stkPush(phone, amount, reference) {
    try {
      const token = await this.getToken();
      const { password, timestamp } = this.generatePassword();

      // Format phone: remove 0 or +254, ensure 254XXXXXXXXX
      let formattedPhone = phone.replace(/^0+/, '').replace(/^\+/, '');
      if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }

      const data = {
        BusinessShortCode: config.mpesa.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: config.mpesa.tillNumber || config.mpesa.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: config.mpesa.callbackUrl,
        AccountReference: reference || 'DancoDevNet',
        TransactionDesc: 'DancoDev Net WiFi Payment'
      };

      const response = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return {
        success: true,
        checkoutRequestID: response.data.CheckoutRequestID,
        merchantRequestID: response.data.MerchantRequestID,
        message: response.data.CustomerMessage
      };
    } catch (error) {
      console.error('M-Pesa STK Push Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Payment failed'
      };
    }
  }

  async queryStatus(checkoutRequestID) {
    try {
      const token = await this.getToken();
      const { password, timestamp } = this.generatePassword();

      const data = {
        BusinessShortCode: config.mpesa.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      };

      const response = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MpesaService();
