const SlackBot = require('slackbots');
const axios = require("axios");
var jf = require("JotForm");

const bot = new SlackBot({
    token: 'your_chat_bot_token',
    name: 'your-chat_bots_name'
})

var jotQuestions = {};
var questionsCount;
var answers = {};
var isStarted = false;
var lastAskedQuestionNumber = 1;
var lastAnswerId;
var submitConfirm = false;
var isAskedUpdate = false;
var updateConfirm = false;
var isUpdateQAsked = false;
var updateQId;
var updateSumbitAsked = false;

jf.options({
    debug: true,
    apiKey: "your_api_key_of_your_jotform_account"

});

//Start Handler
bot.on('start', () => {
    var params = {
        icon_emoji: ':smiley:'
    }
    bot.postMessageToChannel('general',
        'JotBot is alive type fill a jotform to start using bot',
        params);
});
//Error Handler
bot.on('error', (err) => console.log(err));

//On Message
bot.on('message', (data) => {//it trigger everytime there is a new message posted
    if (data.type !== 'message') {
        return;
    }
    if (!isStarted && data.text.includes('<@UCNBP3U95>') && !updateConfirm && !isAskedUpdate && !isUpdateQAsked) {
        handleMessage(data.text);
    }
    else if (isStarted && data.subtype !== 'bot_message' && !updateConfirm && !isAskedUpdate && !isUpdateQAsked) {
        handleAnswer(data.text)
            .then(() => {
                if (questionsCount !== lastAskedQuestionNumber) {
                    askNextQuestion();
                }
                else if (submitConfirm) {
                    submit();
                }
            });
    }
    else if (isAskedUpdate && !updateConfirm && data.subtype !== 'bot_message') {
        confirmUpdate(data.text)
    }
    else if (updateConfirm && !isUpdateQAsked && !updateSumbitAsked && data.subtype !== 'bot_message') {
        handleConfirmUpdate(data.text)
    }
    else if (isUpdateQAsked && data.subtype !== 'bot_message' && !updateSumbitAsked) {
        console.log("handleUpdateAnswer")
        handleUpdateAnswer(data.text)
    }
    else if (updateSumbitAsked && data.subtype !== 'bot_message') {
        checkUpdateSubmit(data.text)
    }
});

//Message Handler
handleMessage = (message) => {
    if (message.includes(' chucknorris') && !isStarted) {
        chuckJoke();
    }
    else if (message.includes(' fill a jotform') && !isStarted) {
        getJotformQuestions()
            .then(() => handleQuestions())
    }

};

getJotformQuestions = () => {// get question from choosed jotform
    return new Promise(function (resolve, reject) {//returns a promise so i could do so i can perform a sync job
        jf.getFormQuestions('82063977123964')
            .then(function (questions) {
                /* successful response after request */
                questionsCount = Object.keys(questions).length;
                jotQuestions = questions;
                resolve();
            })
            .fail(function (e) {
                /* handle error */
                reject();
            })
    })

}
/*
Questions coming from Jotform api is not in order related to question id, 
they have their own order property.
*/

handleQuestions = () => {
    askQuestion();
}

askQuestion = () => {//starts asking question, asks first quesiton only
    for (questionId in jotQuestions) {
        if (jotQuestions[questionId].order === '2') {
            lastAnswerId = questionId.toString();
            lastAnswerName = jotQuestions[questionId].name;
            sendMessage(jotQuestions[questionId].text)
            lastAskedQuestionNumber++;
            isStarted = true;
            break;
        }
    }
}

handleAnswer = (answer) => {//answer handler
    return new Promise(function (resolve) {
        var emailAnswer = [];
        if (jotQuestions[lastAnswerId].validation === 'Email' && answer.includes('|')) {
            emailAnswer = answer.split("|", 2);
            answer = emailAnswer[1];
            answer = answer.slice(0, -1);
        }
        var tempAnswer = new Object(answer);
        var property = `submission[${lastAnswerId}]`;
        answers[property] = tempAnswer;
        if (questionsCount === lastAskedQuestionNumber && confirmSubmit(answer)) {
            submitConfirm = true;
        }
        resolve();
    })

}

handleUpdateAnswer = (answer) => {//update answer hadnler
    return new Promise(function (resolve) {
        var emailAnswer = [];
        if (jotQuestions[updateQId].validation === 'Email' && answer.includes('|')) {
            emailAnswer = answer.split("|", 2);
            answer = emailAnswer[1];
            answer = answer.slice(0, -1);
        }
        console.log("handleUpdateAnswer");
        console.log(answer);
        var tempAnswer = new Object(answer);
        var property = `submission[${updateQId}]`;
        answers[property] = tempAnswer;
        sendMessage("Submit Form?")
            .then(updateSumbitAsked = true)
        console.log(answers);
        resolve();
    })
}

handleConfirmUpdate = (answer) => {
    isUpdateQAsked = true;
    askUpdateQuestion(answer);
}

askNextQuestion = () => {
    for (questionId in jotQuestions) {
        if (jotQuestions[questionId].order === (lastAskedQuestionNumber + 1).toString()) {
            lastAnswerId = questionId.toString();
            lastAnswerName = jotQuestions[questionId].name;
            sendMessage(jotQuestions[questionId].text)
                .then(lastAskedQuestionNumber++)
            break;
        }
    }
}
askUpdateQuestion = (answer) => {
    console.log(answer);
    for (questionId in jotQuestions) {
        console.log(typeof((jotQuestions[questionId].order - 1).toString()))
        console.log(typeof(answer))
        if ((jotQuestions[questionId].order - 1).toString() === answer) {
            updateQId = questionId.toString();
            lastAnswerName = jotQuestions[questionId].name;
            sendMessage(jotQuestions[questionId].text)
            break;
        }
    }
}

submit = () => {
    jf.createFormSubmission('82063977123964', answers)
        .then(function (r) {
            console.log(r);
            sendMessage("Form Submitted");
        })
        .fail(function (e) {
            // handle error 
            console.log(e)
        });
}

sendMessage = (message) => {
    return new Promise(function (resolve) {
        var params = {
            icon_emoji: ':smiley:'
        }
        bot.postMessageToChannel('general',
            message,
            params);
        resolve();
    })
}

askUpdate = () => {
    sendMessage("Do you wish the update your submission")
        .then(isAskedUpdate = true)
}

startUpdate = () => {
    updateConfirm = true;
    isUpdateQAsked = false;
    updateSumbitAsked = false;
    sendMessage("Select question number you would like to update")
}

confirmSubmit = (answer) => {
    var isformEnd = false;
    switch (answer) {
        case 'y': case 'Y': case 'yes': case 'YES': case 'Yes':
            isformEnd = true;
            answers = {};
            isStarted = false;
            lastAskedQuestionNumber = 1;
            isStarted = false;
            break;
        case 'n': case 'N': case 'no': case 'NO': case 'No':
            askUpdate();
            break;
        default:
            isformEnd = false;
    }
    return isformEnd;
}

confirmUpdate = (answer) => {
    var check = false;
    switch (answer) {
        case 'y': case 'Y': case 'yes': case 'YES': case 'Yes':
            check = true;
            startUpdate();
            break;
        case 'n': case 'N': case 'no': case 'NO': case 'No':
            submit();
            break;
        default:
            check = false;
    }
    return check;
}

checkUpdateSubmit = (answer) => {
    var check = false;
    switch (answer) {
        case 'y': case 'Y': case 'yes': case 'YES': case 'Yes':
            check = true;
            submit();
            break;
        case 'n': case 'N': case 'no': case 'NO': case 'No':
            startUpdate();
            break;
        default:
            check = false;
    }
    return check;
}

chuckJoke = () => {
    axios.get('http://api.icndb.com/jokes/random')
        .then(res => {
            const joke = res.data.value.joke;
            var params = {
                icon_emoji: ':smiley:'
            }
            bot.postMessageToChannel('general',
                joke,
                params);
        })
}