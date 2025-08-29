// Defines URL for ChatGPT middleware and database access
var apiURL = "https://ceclnx01.cec.miamioh.edu/~johnsok9/cse383/final/index.php/chatgpt";
var databaseURL = "http://172.17.14.2/final.php";
// Necessary variables for middleware authentication
var uniqueid = "libertem";
var auth = "YohMo2ho";

// Initiliazes event listener for when the document is fully loaded
// Doing this enables the user to be able to press the Submit button multiple times
$(document).ready(function() {
    $("#userInfo").on("click", function() {
        getPromptAndLevel();
    });
});

/*
* Retrives the input values from the user and stores them
*/
function getPromptAndLevel() {
    const userPrompt = $("#prompt").val();
    // Checks to see if the user entered anything
    if (!userPrompt) {
        // The User did not enter anythign, so we do not want to perform any action
        logAnyErrors("Must Enter A Prompt Before Submitting!", "No Error Data");
        return;
    }

    // Clears the input field once we have gotten the users input
    $("#prompt").val("");

    const userLevel = $("#level").val();
    getDescriptionLevel(userPrompt, userLevel);
}

/**
 * Gets the tailored prompt to send to the ai by finding the
 * description corresponding to users selected experience level
 * 
 * @param userPrompt is the users prompt input
 * @param userLevel is users level input
 */
function getDescriptionLevel(userPrompt, userLevel) {
    let userDescription = "blank";

    // api call to get data from level table
    $.ajax({
        url: `${databaseURL}/getLevel`,
        method: "GET"
    }).done(function(data) {

        // Checks if the API Response if valid.
        // If response is not valid, logs the error and stops the
        // execution of the application
        if (data.status != 0) {
            logAnyErrors("Error in API response", data.message);
            return;
        }

        // Find description corresponding to users experience
        data.result.forEach(function(p) {
            if (p.prompt == userLevel) {
                userDescription = p.description;
            }
        });
        // Sends users prompt and tailored description to chaptGPT
        apiRequest(userPrompt, userDescription);
    }).fail(function(error) {
        // Logs any errors to the console if the AJAX call fails
        logAnyErrors("Failed to retrieve Level Data", error);
    });
}

/**
 * Api Call to chatgpt middle sending users prompt and our 
 * tailored description as parameters 
 * 
 * @param userPrompt The user's input
 * @param userDescription Tailored description for the selected user level
 */
function apiRequest(userPrompt, userDescription) {
    const apiData = {
        user_prompt: userPrompt,
        system_prompt: userDescription,
        uniqueid: uniqueid,
        auth: auth,
    };

    // Displays the user's input in the chat box to let the user
    // know that their prompt has been processed and the output
    // is on the way
    displayUserInput(userPrompt);

    // AJAX POST request to ChatGPT middleware
    $.ajax({
        method: "POST",
        url: apiURL,
        data: apiData,
    }).done(function(data) {

        // Checks if the API Response if valid.
        // If response is not valid, logs the error and stops the
        // execution of the application
        if (data.status != 0) {
            logAnyErrors("Error in API response", data.message);
            return;
        }

        // Passes the returned data to a method to handle the response
        apiResponse(data, userPrompt, userDescription);
    }).fail(function(error) {
        // Logs any errors to the console if the AJAX call fails
        logAnyErrors("API Request Failed", error);
    });
}

/**
 * Handles the response from the ChatGPT middleware. Displays
 * the AI's response to the user and logs the necessary input/output data to the database.
 * 
 * @param data Data recieved from our ajax call to api (from apiRequest())
 * @param userPrompt Users input prompt
 * @param userDescription Tailored description for the selected user level 
 */
function apiResponse(data, userPrompt, userDescription) {
    // Gets the actual response from AI
    let textResponse = data.result.message.choices[0].message.content;

    // Displays the Response to the user
    displayAIResponse(textResponse);

    // Creating our own response to store to the database so that we can
    // store only the necessary data and not all of the unnecessary data that
    // is returned from the middleware.
    const responseData = {
        input: {
            userPrompt: userPrompt,
            systemPrompt: userDescription,
        },
        output: {
            aiResponse: data.result.message.choices[0].message.content,
            promptTokens: data.result.message.usage.prompt_tokens,
            completionTokens: data.result.message.usage.completion_tokens,
        }
    }
    // Go to log this data to our log table
    logResponse(responseData);
}

/**
 * Displays what the user entered to act as a messsaging system
 * 
 * @param userPrompt Users input prompt
 */
function displayUserInput(userPrompt) {

    // Makes sure that there aren't any special characters
    // that will mess up the display
    const safePrompt = $("<div>").text(userPrompt).html();

    // Append the user's question (right-aligned)
    $("#response").append(`
        <div class="chat-message user">
            <div class="chat-bubble user">${safePrompt}</div>
        </div>
    `);
}

/**
 * Display the AI's response to the users in our messaging system
 * 
 * @param textResponse the response from AI
 */
function displayAIResponse(textResponse) {

    // Formats the AI response
    // The Response from the ChatGPT middleware is in Markdown Format
    // so we have to go through and change the markdown format to HTML elements
    textResponse = formatChatGPTResponse(textResponse);

    // Append the AI's response (left-aligned)
    $("#response").append(`
        <div class="chat-message ai">
            <div class="chat-bubble ai">${textResponse}</div>
        </div>
    `);
}

/**
 * We realized that the response was in markdown format and had the
 * idea to convert it to HTML elements but were unable to figure it out
 * on our own. We used ChatGPT to help make the method and then added some
 * tweaks to the method to have it better suit what we wanted
 * 
 * Formats the AI's response in a way that will be properly displayed to the user
 * The AI response is given in Markdown format and this function converts
 * the markdown elements to valid HTML elements
 * 
 * @param textResponse the response from the AJAX call 
 * @returns the formatted response
 */
function formatChatGPTResponse(textResponse) {

    // Initialize counter and boolean variable for condition checks
    let formattedText = textResponse;
    let olCounter = 0;
    let inOrderedList = false;

    // Convert Markdown Headers to HTML Headers
    formattedText = formattedText.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    formattedText = formattedText.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    formattedText = formattedText.replace(/^### (.*?)$/gm, '<h3>$1</h3>');

    // Convert inline styles(Bold, Emphasis, Underline)
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formattedText = formattedText.replace(/__(.*?)__/g, '<u>$1</u>');

    // Convert code blocks
    formattedText = formattedText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Convert unordered lists
    formattedText = formattedText.replace(/^- (.*?)$/gm, '<ul><li>$1</li></ul>');
    formattedText = formattedText.replace(/<\/ul>\s*<ul>/g, ''); // Merge adjacent unordered lists

    // Convert ordered lists
    formattedText = formattedText.replace(/^\d+\.\s+(.*?)$/gm, (match, item) => {
        if (!inOrderedList) {
            olCounter = 0; // Reset counter for a new list
            inOrderedList = true;
        }
        olCounter++;
        return `<ol><li>${item}</li></ol>`;
    });
    // Merge adjacent ordered lists and resets the current state
    formattedText = formattedText.replace(/<\/ol>\s*<ol>/g, '');
    inOrderedList = false;

    // Replace logical operators (&& and ||)
    formattedText = formattedText.replace(/\&\&/g, '&amp;&amp;');
    formattedText = formattedText.replace(/\|\|/g, '&amp;&#124;&#124;');

    // Return the formatted HTML
    return formattedText;
}

/**
 * Logs all of the response data to our log table in the database
 * 
 * @param responseData The important data from the API request
 */
function logResponse(responseData) {
    // Ajax post call to our addLog API method (Inserts data to our log table)
    $.ajax({
        url: `${databaseURL}/addLog`,
        method: "POST",
        data: responseData,
    }).done(function(data) {

        // Checks if the API Response if valid.
        // If response is not valid, logs the error and stops the
        // execution of the application
        if (data.status != 0) {
            logAnyErrors("Error in API response", data.message);
            return;
        }

        // Logs Success Message to the console
        console.log("Response logged successfully.");
    }).fail(function(error) {
        logAnyErrors("Failed to add Data to the DataBase", error);
    });
}

/**
 * Displays Error Messages in the console error section
 * 
 * @param errorMessage The Error Message to log
 * @param errorData The Error Data to log
 */
function logAnyErrors(errorMessage, errorData) {
    console.error(errorMessage, errorData);
}
