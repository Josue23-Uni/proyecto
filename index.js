const Alexa = require('ask-sdk-core');

// Funciones helper
function formatDateTime(timeString, timeZone) {
    const [hours, minutes] = timeString.split(':');
    const now = new Date();
    const scheduledDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        parseInt(hours),
        parseInt(minutes) || 0
    ));
    return scheduledDate.toISOString();
}

function getRecurrencePattern(recurrence) {
    const patterns = {
        'diario': 'FREQ=DAILY;INTERVAL=1',
        'diariamente': 'FREQ=DAILY;INTERVAL=1',
        'cada día': 'FREQ=DAILY;INTERVAL=1',
        'semanal': 'FREQ=WEEKLY;INTERVAL=1',
        'semanalmente': 'FREQ=WEEKLY;INTERVAL=1',
        'cada semana': 'FREQ=WEEKLY;INTERVAL=1',
        'mensual': 'FREQ=MONTHLY;INTERVAL=1',
        'mensualmente': 'FREQ=MONTHLY;INTERVAL=1',
        'cada mes': 'FREQ=MONTHLY;INTERVAL=1',
        'lunes a viernes': 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        'días laborables': 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        'fin de semana': 'FREQ=WEEKLY;BYDAY=SA,SU'
    };
    
    return patterns[recurrence.toLowerCase()] || null;
}

function getRecurrenceDescription(recurrence) {
    const descriptions = {
        'diario': 'todos los días',
        'diariamente': 'todos los días',
        'cada día': 'todos los días',
        'semanal': 'cada semana',
        'semanalmente': 'cada semana',
        'cada semana': 'cada semana',
        'mensual': 'cada mes',
        'mensualmente': 'cada mes',
        'cada mes': 'cada mes',
        'lunes a viernes': 'de lunes a viernes',
        'días laborables': 'en días laborables',
        'fin de semana': 'los fines de semana'
    };
    
    return descriptions[recurrence.toLowerCase()] || '';
}

// Handler para el intento de establecer recordatorio
const SetReminderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetReminderIntent';
    },
    async handle(handlerInput) {
        const { requestEnvelope, serviceClientFactory, responseBuilder } = handlerInput;
        const { intent } = requestEnvelope.request;
        
        const reminderText = intent.slots.reminderText.value;
        const reminderTime = intent.slots.reminderTime.value;
        const recurrence = intent.slots.recurrence && intent.slots.recurrence.value;

        // Validaciones
        if (!reminderTime) {
            return responseBuilder
              .speak("¿A qué hora pongo el recordatorio?")
              .getResponse();
        }
        if (!reminderText) {
            return responseBuilder
              .speak("Por favor dime qué quieres que te recuerde.")
              .getResponse();
        }

        try {
            const reminderServiceClient = serviceClientFactory.getReminderManagementServiceClient();
            const upsServiceClient = serviceClientFactory.getUpsServiceClient();

            const deviceId = requestEnvelope.context.System.device.deviceId;
            const userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);
            
            // Configuración del recordatorio
            const trigger = {
                type: 'SCHEDULED_ABSOLUTE',
                scheduledTime: formatDateTime(reminderTime, userTimeZone),
                timeZoneId: userTimeZone
            };

            if (recurrence) {
                const recurrencePattern = getRecurrencePattern(recurrence);
                if (!recurrencePattern) {
                    return responseBuilder
                        .speak(`No reconozco el patrón de recurrencia "${recurrence}". Prueba con "diario", "semanal" o "mensual".`)
                        .getResponse();
                }
                trigger.recurrence = recurrencePattern;
            }

            const reminderRequest = {
                requestTime: new Date().toISOString(),
                trigger: trigger,
                alertInfo: {
                    spokenInfo: {
                        content: [{
                            locale: 'es-ES',
                            text: `Recordatorio: ${reminderText}`,
                        }],
                    },
                },
                pushNotification: { status: 'ENABLED' }
            };

            await reminderServiceClient.createReminder(reminderRequest);
            
            let speakOutput = `He configurado tu recordatorio para "${reminderText}" a las ${reminderTime}`;
            if (recurrence) {
                speakOutput += `, que se repetirá ${getRecurrenceDescription(recurrence)}.`;
            } else {
                speakOutput += '.';
            }
            
            return responseBuilder
                .speak(speakOutput)
                .getResponse();
                
        } catch (error) {
            console.error('Error al crear recordatorio:', error);
            return responseBuilder
                .speak('Lo siento, hubo un problema al crear tu recordatorio. Por favor, inténtalo de nuevo.')
                .getResponse();
        }
    }
};

// Handler para el intento de ayuda
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Puedes decirme cosas como: "¿Qué te gustaría recordar?" o ' +
                           '"Recuérdame la reunión los viernes a las 3 pm". ¿En qué puedo ayudarte?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// Handler para el intento de "Sí"
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Perfecto. ¿Qué quieres que te recuerde y a qué hora?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// Handler para el lanzamiento de la skill
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const { permissions } = handlerInput.requestEnvelope.context.System.user;

        if (!permissions) {
            return handlerInput.responseBuilder
                .speak("Bienvenido a Recordatorios Inteligentes. Necesito permiso para gestionar tus recordatorios.")
                .addDirective({
                    type: "Connections.SendRequest",
                    name: "AskFor",
                    payload: {
                        "@type": "AskForPermissionsConsentRequest",
                        "@version": "1",
                        "permissionScope": "alexa::alerts:reminders:skill:readwrite"
                    },
                    token: ""
                })
                .getResponse();
        } else {
            const speakOutput = "¿Qué te gustaría recordar?";
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }
    }
};

// Handler para cancelar o detener
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(Alexa.getIntentName(handlerInput.requestEnvelope));
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('¡Hasta luego! Recuerda que puedes pedirme que te recuerde cosas importantes.')
            .getResponse();
    }
};

// Handler de errores
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error: ${error.message}`);
        return handlerInput.responseBuilder
            .speak('Lo siento, ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo.')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        SetReminderIntentHandler,
        YesIntentHandler,
        LaunchRequestHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler
    )
    .withApiClient(new Alexa.DefaultApiClient()) 
    .addErrorHandlers(ErrorHandler)
    .lambda();
