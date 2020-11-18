const Alexa = require('ask-sdk-core');
const https = require('https');

// Enphase handlers.
const urlBase = 'https://api.enphaseenergy.com/api/v2/systems/772052/';
const userId = '4e5467774e7a49340a';
const apiKey = '46afa32aa1d650c33b9f948921601226';

const GetPowerIntentHandler = {
  canHandle(handlerInput) {
    const { type, intent } = handlerInput.requestEnvelope.request;
    return type === 'IntentRequest' && intent.name === 'GetPower';
  },
  async handle(handlerInput) {
    const data = await getSummaryFromEnphase();
    const { current_power } = data;
    const currentPower = getFormattedPower(data.current_power);
    const speech = `Your array is currently producing ${currentPower}.`;
    return handlerInput.responseBuilder.speak(speech).getResponse();
  },
};

const GetEnergyIntentHandler = {
  canHandle(handlerInput) {
    const { type, intent } = handlerInput.requestEnvelope.request;
    return type === 'IntentRequest' && intent.name === 'GetEnergy';
  },
  async handle(handlerInput) {
    const intent = handlerInput.requestEnvelope.request.intent;
    const { StartDate } = intent.slots;

    const today = new Date();
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1);
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    let responseType;
    let startDate;
    let endDate;

    if (StartDate && StartDate.value) {
      const date = new Date(StartDate.value);
      if (StartDate.value.length === 4) {
        // year only
        startDate = new Date(date.getFullYear(), 1, 1);
        endDate = new Date(date.getFullYear() + 1, 0, 0);
        responseType = 'year';
      } else if (StartDate.value.length === 7) {
        // year and month only
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        responseType = 'month';
      } else {
        startDate = date;
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 1);
        responseType = 'day';
      }
    } else {
      startDate = new Date(yesterday);
      endDate = new Date(today);
    }

    // convert to ISO Date Strings for the Enphase API
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];
    const yearString = startDate.getFullYear();
    const monthString = monthNames[startDate.getMonth()];

    const data = await getEnergyFromEnphase(startDateString, endDateString);
    const energy = data.production.reduce((a, b) => a + b, 0);
    const energyString = getFormattedEnergy(energy);
    
    let speech = '';
    if (responseType === 'year') {
      speech = `In ${yearString} your array produced ${energyString}.`;
    } else if (responseType === 'month') {
      speech = `In ${monthString} of ${yearString}, your array produced ${energyString}.`
    } else {
      speech = `On ${startDateString}, your array produced ${energyString}.`;
    }

    return handlerInput.responseBuilder.speak(speech).getResponse();
  },
};

const GetStatusIntentHandler = {
  canHandle(handlerInput) {
    const { type, intent } = handlerInput.requestEnvelope.request;
    return type === 'IntentRequest' && intent.name === 'GetStatus';
  },
  async handle(handlerInput) {
    const data = await getSummaryFromEnphase();

    let speech;
    if (data.status === 'normal') {
      const currentPower = getFormattedPower(data.current_power);
      const energyToday = getFormattedEnergy(data.energy_today);
      speech = `Your array is currently producing ${currentPower} of power. So far, it has produced ${energyToday} of energy today.`;
    } else {
      speech = 'There appears to be an issue with you array.';
    }

    return handlerInput.responseBuilder.speak(speech).getResponse();
  },
};

const enphaseFetch = url => {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        let body = '';

        res.on('data', chunk => {
          body += chunk;
        });

        res.on('end', () => {
          const data = JSON.parse(body);
          resolve(data);
        });
      })
      .on('error', err => {
        console.log('Got error: ', err);
        reject(err);
      });
  });
};

const getEnergyFromEnphase = (startDate, endDate) =>
  enphaseFetch(
    `${urlBase}energy_lifetime?start_date=${startDate}&end_date=${endDate}&key=${apiKey}&user_id=${userId}`,
  );

const getSummaryFromEnphase = () =>
  enphaseFetch(`${urlBase}summary?key=${apiKey}&user_id=${userId}`);

const getFormattedPower = (watts) => {
    const power = watts > 1000 ? Math.round(watts / 1000) : watts;
    const unit = watts > 1000 ? 'kW' : 'W';
    return `${power}${unit}`;
};

const getFormattedEnergy = (wattHours) => {
    const power = wattHours > 1000 ? Math.round(wattHours / 1000) : wattHours;
    const unit = wattHours > 1000 ? 'kWh' : 'Wh';
    return `${power}${unit}`;
};

const IntentReflectorHandler = {
  canHandle(handlerInput) {
    const { type } = handlerInput.requestEnvelope.request;
    return type === 'IntentRequest';
  },
  handle(handlerInput) {
    const { intent } = handlerInput.requestEnvelope.request;
    const speechText = `You just triggered ${intent.name}`;

    return handlerInput.responseBuilder.speak(speechText).getResponse();
  },
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'Welcome, you can say Hello or Help. Which would you like to try?';
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput) {
    const speechText = 'You can say hello to me! How can I help?';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent')
    );
  },
  handle(handlerInput) {
    const speechText = 'Goodbye!';
    return handlerInput.responseBuilder.speak(speechText).getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    // Any cleanup logic goes here.
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`~~~~ Error handled: ${error.message}`);
    const speechText = `Sorry, I couldn't understand what you said. Please try again.`;
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

// This handler acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    GetEnergyIntentHandler,
    GetPowerIntentHandler,
    GetStatusIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
