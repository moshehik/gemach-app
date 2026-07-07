/**
 * Nedarim Plus API Integration
 * Translated from the original MS Access VBA codebase.
 */

/**
 * Charge a credit card via Nedarim Plus WebService.
 * @param {Object} params - The payment parameters.
 * @param {string} params.mosadId - The institution ID (Mosad) in Nedarim Plus.
 * @param {string} params.clientName - The customer's name.
 * @param {string} params.address - The customer's address.
 * @param {string} params.phone - The customer's phone number.
 * @param {string} params.cardNumber - The credit card number.
 * @param {string} params.tokef - The expiry date (MMYY).
 * @param {number} params.amount - The amount to charge.
 * @param {number} params.installments - Number of installments (Tashloumim).
 * @param {string} params.notes - Notes for the transaction (Avour).
 * @param {boolean} params.isKeva - Whether this is a recurring payment (Horaat Keva).
 * @returns {Promise<{success: boolean, confirmation?: string, error?: string, rawResponse: string}>}
 */
export async function chargeNedarimPlus({
  mosadId,
  clientName = '',
  address = '',
  phone = '',
  cardNumber,
  tokef,
  amount,
  installments = 1,
  notes = '',
  isKeva = false,
}) {
  const endpoint = isKeva ? 'DebitKeva.aspx' : 'DebitCard.aspx';
  const url = `https://www.matara.pro/nedarimplus/V6/Files/WebServices/${endpoint}`;

  const bodyParams = new URLSearchParams({
    Mosad: mosadId,
    ClientName: clientName,
    Adresse: address,
    Phone: phone,
    ClientId: '', // Optional
    CardNumber: cardNumber,
    Tokef: tokef,
    Amount: amount.toString(),
    Tashloumim: installments.toString(),
    Groupe: '', // Optional
    Avour: notes,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const resultText = await response.text();
    
    // Nedarim Plus might return JSON-like string, but historically the VBA parsed it manually.
    // Assuming the response is a JSON string. We can try to parse it.
    try {
      const resultJson = JSON.parse(resultText);
      
      if (resultJson.Status === 'Error') {
        return {
          success: false,
          error: resultJson.Message,
          rawResponse: resultText,
        };
      } else {
        return {
          success: true,
          confirmation: resultJson.Confirmation,
          rawResponse: resultText,
        };
      }
    } catch (parseError) {
      // Fallback for non-standard JSON response (as handled in the VBA script)
      if (resultText.includes('"Status" : "Error"')) {
        // Simple regex extraction for error message
        const match = resultText.match(/"Message"\s*:\s*"([^"]+)"/);
        return {
          success: false,
          error: match ? match[1] : 'Unknown Error',
          rawResponse: resultText,
        };
      } else if (resultText.includes('"Confirmation"')) {
        const match = resultText.match(/"Confirmation"\s*:\s*"([^"]+)"/);
        return {
          success: true,
          confirmation: match ? match[1] : 'Unknown Confirmation',
          rawResponse: resultText,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format from Nedarim Plus',
          rawResponse: resultText,
        };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      rawResponse: '',
    };
  }
}
