const Alexa = require('ask-sdk-core');

const SetReminderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetReminderIntent';
    },
    async handle(handlerInput) {
        const reminderText = handlerInput.requestEnvelope.request.intent.slots.reminderText.value;
       const reminderTime = handlerInput.requestEnvelope.request.intent.slots.reminderTime.value;
        const {intent}=handlerInput.requestEnvelope.request;
        //const reminderText = "mi recordatorio"
        //const reminderTime = new Date() 
        if (!reminderTime) {
            return handlerInput.responseBuilder
              .speak("¿A qué hora pongo el recordatorio?")
               //.reprompt("¿A qué hora pongo el recordatorio?")
               .getResponse();
        }
if (!reminderText) {
            return handlerInput.responseBuilder
              .speak("Por favor dime qué quieres que te recuerde.")
               .getResponse();
        }
        const reminderServiceClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient();
        const upsServiceClient = handlerInput.serviceClientFactory.getUpsServiceClient();

        const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
        const userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);
        const currentDateTime = new Date(new Date().toLocaleString("en-ES", { timeZone: userTimeZone }));
        const scheduledDateTime = new Date(currentDateTime.toDateString());

        const isoTime = scheduledDateTime.toISOString();

        const reminderRequest = {
            requestTime: new Date().toISOString(),
            trigger: {
                type: 'SCHEDULED_ABSOLUTE',
                scheduledTime: isoTime,
                timeZoneId: userTimeZone,
            },
            alertInfo: {
                spokenInfo: {
                    content: [{
                        locale: 'es-ES',
                        text: 'Recordatorio: ${reminderText}',
                    }],
                },
            },
            pushNotification: { status: 'ENABLED' }
        };

        await reminderServiceClient.createReminder(reminderRequest);

        return handlerInput.responseBuilder
            .speak('He configurado tu recordatorio para ${reminderText} a las ${reminderTime}')
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Puedes decir, por ejemplo: recuérdame tomar agua a las 6 de la tarde.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    handle(handlerInput) {
        const speakOutput = '¿Qué quieres que te recuerde?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest'
            || (Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
                && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'TimerStartIntent'));
    },
    handle(handlerInput) {

        const { permissions } = handlerInput.requestEnvelope.context.System.user;

        if (!permissions) {

            handlerInput.responseBuilder
                .speak("Esta habilidad necesita permiso para acceder a tus temporizadores.")
                .addDirective({
                    type: "Connections.SendRequest",
                    name: "AskFor",
                    payload: {
                        "@type": "AskForPermissionsConsentRequest",
                        "@version": "1",
                        "permissionScope": "alexa::alerts:timers:skill:readwrite"
                    },
                    token: ""
                });

        } else {
            handlerInput.responseBuilder
                .speak("¿Quieres configurar un temporizador?")
                .reprompt("¿Quieres configurar un temporizador?")
        }

        return handlerInput.responseBuilder
            .getResponse();

    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(Alexa.getIntentName(handlerInput.requestEnvelope));
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('¡Hasta luego!')
            .getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error: ${error.message}`);
        return handlerInput.responseBuilder
            .speak('Lo siento, ha ocurrido un error.')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        YesIntentHandler,
        LaunchRequestHandler,
        SetReminderIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler
    )
    .withApiClient(new Alexa.DefaultApiClient()) 
    .addErrorHandlers(ErrorHandler)
    .lambda();
