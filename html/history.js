// URL used to communicate with the database
var databaseURL = "http://172.17.14.2/final.php";

// Initiliazes event listener for when the document is fully loaded
// Doing this gives all of our buttons the ability to be pressed multiple times,
// and ensures that everything is displayed correctly
$(document).ready(function() {
    // Displays all of the Stored Logs once the page is fully loaded
    printAllHistory();

    // Displays Filtered History Data when the button is clicked
    $("#filterInfo").on("click", function() {
        // Clears Previously display logs
        $("#history-output").html("");
        // Clears Previous Filter Token Info
        $("#filter-token-info").html("");
        // Calls function to filter logs based on what the user inputed
        getFilterInfo();
    });

    // Resets all of the filter options and displays unfiltered logs
    // when the Clear All Button is clicked
    $("#clearAll").on("click", function() {
        // Resets Filter Options
        resetFilters();
        // Clears previusly displayed logs
        $("#history-output").html("");
        // Clears previous filter token info
        $("#filter-token-info").html("");
        // Clears present day filter token info
        $("#present-token-info").html("");
        // Displays all of the stored logs
        printAllHistory();
    });

    // This function is triggered whenever a "view details" button is
    // clicked on any of the history logs
    // Displays Detailed Info on a Modal 
    $(document).on("click", ".view-details", function() {
        // Gets the details of the selected log entry
        // This works because when the log entry is created, the necessary
        // info is stored in the view details button as data
        const details = $(this).data();

        // Formats the AI response
        // The Response from the ChatGPT middleware is in Markdown Format
        // so we have to go through and change the markdown format to HTML elements
        let aiResponse = formatChatGPTResponse(details.airesponse);

        // Populates the HTML modal with the details of the selected log entry
        $("#modalDate").text(details.dateandtime);
        $("#modalUserInput").text(details.userinput);
        $("#modalSystemPrompt").text(details.systemprompt);
        $("#modalAiResponse").html(`<pre>${aiResponse}</pre>`);
        $("#modalTotalCost").text(details.totalcost.toFixed(5));
        $("#modalPromptToken").text(details.prompttokendetails);
        $("#modalOutputToken").text(details.completiontokendetails);

        // Shows the Modal with the correct details to the user on the front-end
        $("#detailsModal").modal("show");
    });

    // Hides the modal from the user when the button is clicked
    $(".close-button").on("click", function() {
        $("#detailsModal").modal("hide");
    });

});
/**
 * Function to display all history logs
 */
function printAllHistory() {
    // Gets today's date in YYYY-MM-DD format (EST)
    const todaysDate = getCurrentDate();

    // AJAX GET request to fetch all logs from the log database
    $.ajax({
        url: `${databaseURL}/displayLog`,
        method: "GET",
    }).done(function(data) {

        // Checks if the API Response if valid.
        // If response is not valid, logs the error and stops the
        // execution of the application
        if (data.status != 0) {
            logAnyErrors("Error in API response", data.message);
            return;
        }
        
        // Processes and Displays the Data receives from the AJAX Call
        processHistoryLogData(data, todaysDate, false);
    }).fail(function(error) {
        // Logs any AJAX errors that could occur
        logAnyErrors("Failed to Display DataBase Entries", error);
    });
}

/**
 * Function to retrive the filter info that was entered by the user
 * Filter Options:
 *  - Date
 *  - Number of Logs
 *  - Cost (Ascending or Descending)
 */
function getFilterInfo() {
    // Gets the date and numRec values from the user input
    const dateVal = $("#date").val();
    const numRec = $("#numRec").val();
    // Builds the query based on filters
    let query = buildQuery(dateVal, numRec);

    // Ajax POST call to filter the results the way the user specified
    $.ajax({
        url: `${databaseURL}/filterLog`,
        method: "POST",
        data: { query: query },
    }).done(function(data) {

        // Checks if the API Response if valid.
        // If response is not valid, logs the error and stops the
        // execution of the application
        if (data.status != 0) {
            logAnyErrors("Error in API response", data.message);
            return;
        }
        
        // Gets today's date in YYYY-MM-DD format (EST)
        // This is used if the user did not specify a certain
        // date to filter by
        const todaysDate = getCurrentDate();

        // If the user filtered by a date
        if (dateVal) {
            processHistoryLogData(data, dateVal, true);
        // If the user did not select any filters
        } else if (!dateVal && !numRec) {
            $("#present-token-info").html("");
            processHistoryLogData(data, todaysDate, false);
        // If the user only filtered by numRecs
        } else {
            processHistoryLogData(data, todaysDate, true);
        }
    }).fail(function(error) {
        logAnyErrors("Failed to Filter DataBase Entries", error);
    });
}

/**
 * Function to build the query for filtering logs based on
 * the selected filters by the user
 * 
 * The SQL Statement is Dynammicaly created based off the user inputs
 * Filter Options:
 *  - Date
 *  - Number of Logs
 *  - Cost (Ascending or Descending)
 *
 * Cost has to be handled in a different function because we were not
 * able to do it in the SQL statement because cost is stored in the output
 * field in the database which is not able to be accessed
 * and delt with from the SQL statement
 * 
 * @param dateVal the date selected by the user
 * @param numRec  the number of records selected by the user
 * @returns The Dynamically created Query
 */
function buildQuery(dateVal, numRec) {
    // Base Query that will select all log entries from the database
    let query = "SELECT * FROM log";

    // Checks to see if the user entered a specific date to filter by
    if (dateVal) {
        // Get the start and end times for the selected date in UTC
        const { startOfDayUTC, endOfDayUTC } = getStartAndEndOfDayInUTC(dateVal);
        // Modify the query to filter the UTC timestamp range
        query += ` WHERE datetime >= '${startOfDayUTC}' AND datetime <= '${endOfDayUTC}'`;
    }

    // Modifies the query to always display the most recent logs first
    query += " ORDER BY datetime DESC";

    // Checks to see if the user entered a specific number of elements to display
    if (numRec) {
        // Modifies the query to show the desired number of logs
        query += ` LIMIT ${numRec}`;
    }

    return query;
}

/**
 * This function is the center point for most of the AI Tutor History Page
 * It processes the history log data calculating token usage/request cost for
 * the current day and for the filtered data, handles sorting and filtering
 * on the log data, and display various results in a clean manner.
 * 
 * @param data the data containing history log entries
 * @param specifiedDate the date to calculate token cost and numbers by
 * @param isFiltered A flag to indiciate if the token information should
 *                         be appended to the present day info or filtered info
 */
function processHistoryLogData(data, specifiedDate, isFiltered) {
    // Counters used for token number and total cost
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let dailyTotalCost = 0.0;

    // An Array used to store each processed history item
    // This array is used for sorting by cost
    let historyItems = [];

    // Checks if the data and result properties are valid
    if (data && data.result) {
        // For Each loop to iterate through each element in the results
        data.result.forEach(function(p) {
            // Stores input, output, and datetime from the current element
            const input = p.input;
            const output = p.output;
            // Datetime is in the format YYYY-MM-DD 00:00:00 UTC
            const datetime = p.datetime;

            // This function call is taking the UTC format datetime and transforming it
            // into MM/DD/YYYY 00:00:00(EST) AM/PM. These values are stored in simplifiedDate,
            // time, and morningOrNight for later use.
            const { simplifiedDate, time, morningOrNight} = formatDateAndTime(datetime);

            // In order to calculate the token information for the user inputted date
            // both the specifiedDate and simplifedDate need to be in the same format.
            // Specified Date is YYYY-MM-DD, while simplifiedDate is MM/DD/YYYY
            // This function converts simplifiedDate into YYYY-MM-DD
            const sameFormatDate = convertToDateFormat(simplifiedDate);

            // Parses the log data output into a JSON object so that
            // we can use the data stored in the output
            const parsedJSONData = parseLogData(output);

            // Calculates the total cost for the individual request
            const totalCost = calculateRequestCost(parsedJSONData.promptTokens,
                                                 parsedJSONData.completionTokens);

            // If the current set of data is filtered/ascending or descending order
            // or the entry matches the specified date.
            // Then we add the tokens for the current element to the total
            if (isFiltered || sameFormatDate === specifiedDate) {
                dailyTotalCost += totalCost;
                totalInputTokens += parsedJSONData.promptTokens;
                totalOutputTokens += parsedJSONData.completionTokens;
            }

            // Pushes the current element into the historyItem array
            // each element contains the necessary information
            // for later operations
            historyItems.push({
                simplifiedDate: simplifiedDate,
                time: time,
                morningOrNight: morningOrNight,
                input: input,
                output: output,
                cost: totalCost
            });
        });

        // Gets the sorting order prefrence if one was selected
        const sortOrder = getSortOrder();

        // Checks to see if a sort order was specified
        // If not selected, just continues on
        if (sortOrder) {
            // If a sort order was selected, sorts the historyItems by cost
            historyItems = sortByCostOrder(historyItems, sortOrder);
        }

        // Displays each history log item
        historyItems.forEach(function(item) {
            showEachPastRequest(item.simplifiedDate, item.time, item.morningOrNight, item.input, item.output, item.cost);
        });

    }
    // If the data is filtered, displays the token count and cost to the filtered section
    // If not, displays the token count and cost to the daily section. This occurs on the
    // first call when the tutor history page is opened
    if (isFiltered) {
        displayFilteredCost(totalInputTokens, totalOutputTokens, dailyTotalCost);
    } else {
        displayUnfilteredCost(totalInputTokens, totalOutputTokens, dailyTotalCost, specifiedDate);
    }
}

/**
 * Function to format datetime YYYY-MM-DD 00:00:00 UTC
 * into MM/DD/YYYY 00:00:00(EST) AM/PM and return
 * the values in their specified variable
 * 
 * @param datetime the date and time of the current log entry in
 *                  YYYY-MM-DD 00:00:00 UTC format
 * @returns the desired dateformat stored in specific variables
 */
function formatDateAndTime(datetime) {
    // Function to convert the UTC date to MM/DD/YYYY 00:00:0000(EST) AM/PM
    const formatDate = formatToEST(datetime);
    // Stores the three distinct parts of the date into their own variables
    const [simplifiedDate, time, morningOrNight] = formatDate.split(' ');
    // Returns the variables
    return { simplifiedDate, time, morningOrNight };
}

/**
 * Function converts a simplified date string MM/DD/YYYY into
 * the date format YYYY-MM-DD
 * 
 * @param simplifiedDate the date in MM/DD/YYYY format
 * @returns the date in YYYY-MM-DD format
 */
function convertToDateFormat(simplifiedDate) {
    // Splits the simplifiedDate by '/' into three distinct part all stored in an array
    const [month, day, year] = simplifiedDate.split('/');
    // Puts the date parts into the correct format
    const sameFormatDate = `${year}-${month}-${day}`;
    // Returns the correct formatted date
    return sameFormatDate;
}

/**
 * Function parses the output string into JSON Data and 
 * stores the prompt and completion token data
 * 
 * @param output the output sting that contains the JSON data
 *               for an individual history log element
 * @returns A JSON object containing the promptTokens and completionTokens
 *               for the individual history log element
 */
function parseLogData(output) {
    // Converts the JSON string into an Object
    const outputData = JSON.parse(output);

    // Extracts the promptTokens and completeitionTokens and parses them as Integers
    const parsedJSONData = {
        promptTokens: parseInt(outputData.promptTokens),
        completionTokens: parseInt(outputData.completionTokens)
    };

    // Returns the data
    return parsedJSONData;
}

/**
 * Function to calculate the total cost for the individual
 * request based on the cost of each prompt and compleition Token
 * 
 * Prompt Token Cost: 15 Cents per million input
 * Completition Token Cost: 60 Cents per million output
 * 
 * @param promptTokens the amount of input tokens
 * @param {*} completionTokens the amount of output tokens
 * @returns the total cost for the individual request
 */
function calculateRequestCost(promptTokens, completionTokens) {
    const inputCost = promptTokens * 0.00000015;
    const outputCost = completionTokens * 0.0000006;
    return inputCost + outputCost;
}

/**
 * Function to sort the history itmes in either ascending
 * or descending orde rbased on the cost of their request
 * 
 * @param historyItems An Array of objects, with each cost having a cost element
 * @param sortOrder The order that the user wants to sort the objects
 * @returns An Array of history items that have been sorted by their cost
 */
function sortByCostOrder(historyItems, sortOrder) {
    if (sortOrder === "ascending") {
        return historyItems.sort((a, b) => a.cost - b.cost);
    } else if (sortOrder === "descending") {
        return historyItems.sort((a, b) => b.cost - a.cost);
    } else {
        return historyItems;
    }
}

/**
 * Function to display each past request to the user in
 * a formatted card.
 * 
 * @param simplifiedDate the date of the request in MM/DD/YYYY format
 * @param time the time of the request in HH:MM format
 * @param morningOrNight a variable indicating whether the request was in AM or PM
 * @param input the input data for the request. This includes the userPrompt and SystemPrompt
 * @param output the output data for the request. This includes the aiResponse,
 *                              promptTokens, and completitionTokens
 * @param cost the total cost of the request based on its tokens
 */
function showEachPastRequest(simplifiedDate, time, morningOrNight, input, output, cost) {
    // Parse the input and output to JSON data so that we can use it
    const inputData = JSON.parse(input);
    const outputData = JSON.parse(output);

    // Stores the userPrompt to be used as a prompt preview for the card
    const promptPreview = inputData.userPrompt;

    // Populates Info for View Details
    // The user Input
    const userInput = inputData.userPrompt;
    // The systems prompt used for the experience level of the user
    const systemPrompt = inputData.systemPrompt;

    // The aiResponse. We must clean this data because it can contain elements that will cause
    // issues with display. We ran into an issue where if we did not clean the code,
    // when passing the aiResponse through the button, certain characters would render,
    // into the page causing the entire button to start displaying the aiResponse.
    // By using this method we were able to get rid of the issue
    const aiResponse = sanitizeInput(outputData.aiResponse);

    // The number of tokens for the request
    const prompTokenDetails = outputData.promptTokens;
    const completionTokenDetails = outputData.completionTokens;

    // Appends the formatted card that displays the request information to the user
    // Also sets up the button to where if pressed it will pass all of the information
    // about this request to the modal to be displayed to the user.
    $("#history-output").append(`
        <div class="card mb-3">
            <div class="card-header">
                <h5 class="card-title">Date: ${simplifiedDate} Time: ${time} ${morningOrNight}</h5>
            </div>
            <div class="card-body">
                <p class="card-text">
                    <strong>Prompt Preview</strong><br>
                    <span>${promptPreview}</span><br><br>
                    <strong>Cost:</strong> $${cost.toFixed(5)}
                </p>
                <button class="btn btn-info view-details"
                        data-dateAndTime="${simplifiedDate} ${time} ${morningOrNight}"
                        data-userInput="${userInput}"
                        data-systemPrompt="${systemPrompt}"
                        data-aiResponse="${aiResponse}"
                        data-promptTokenDetails="${prompTokenDetails}"
                        data-completionTokenDetails="${completionTokenDetails}"
                        data-totalCost="${cost}">
                    View Details
                </button>
            </div>
        </div>
    `);
}

/**
 * We ran into an issue where the aiResponse could possibily break
 * the view details button. Specifcally, this happened very frequently when
 * the tutor was asked what an if statement was. Some sequence of characters
 * that the tutor returned led to the code interpretting the aiResponse 
 * as actual code and this caused the button to break
 * and the front end view to be disrupted.
 * 
 * Function to sanitize te AI's response by escaping special characters
 * that could break HTML rendering.
 * 
 * @param input the aiResponse to be sanitized
 * @returns A sanitized version of the response, where special HTMl characters
 *          have been replaced with their escape sequences.
 */
function sanitizeInput(input) {
    return input
        .replace(/&/g, "&amp;")   // Escape '&' to '&amp;'
        .replace(/</g, "&lt;")    // Escape '<' to '&lt;' Used to start an HTML tag
        .replace(/>/g, "&gt;")    // Escape '>' to '&gt;' Used to end an HTML tag
        .replace(/"/g, "&quot;")  // Escape '"' to '&quot;'
        .replace(/'/g, "&#039;"); // Escape "'" to '&#039;'
}

/*
* We realized that the response was in markdown format and had the
* idea to convert it to HTML elements but were unable to figure it out
* on our own. We used ChatGPT to help make the method and then added some
* tweaks to the method to have it better suit what we wanted
*
* Formats the AI's response in a way that will be properly displayed to the user
* The AI response is given in Markdown format and this function converts
* the markdown elements to valid HTML elements
* @param textResponse the response from the AJAX call
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
 * Function to display the token information for filtered results.
 * This includes the total cost, total input tokens, and total output tokens.
 * 
 * @param totalInputTokens the total number of input tokens in the filtered results
 * @param totalOutputTokens the total number of output tokens in the filtered results
 * @param dailyTotalCost the total cost for the filtered results
 */
function displayFilteredCost(totalInputTokens, totalOutputTokens, dailyTotalCost) {
    $("#filter-token-info").append(`
        <h5>Total Cost for Filtered Data: $${dailyTotalCost.toFixed(5)}</h5>
        <h5>Total Input Tokens: ${totalInputTokens}</h5>
        <h5>Total Output Tokens: ${totalOutputTokens}</h5>
    `);
}

/**
 * Function to display the token information for the current Day
 * This function is called when the Tutor History Page is opened and
 * we want to calculate the token information for the current day
 * This includes the total cost, total input tokens, and total output tokens
 * 
 * @param totalInputTokens the total number of input tokens for the current day
 * @param totalOutputTokens the total number of output tokens for the current day
 * @param dailyTotalCost the total cost for the current day
 * @param specifiedDate the current day
 */
function displayUnfilteredCost(totalInputTokens, totalOutputTokens, dailyTotalCost, specifiedDate) {
    $("#present-token-info").append(`
        <h5>Total Cost for ${specifiedDate}: $${dailyTotalCost.toFixed(5)}</h5>
        <h5>Total Input Tokens: ${totalInputTokens}</h5>
        <h5>Total Output Tokens: ${totalOutputTokens}</h5>
    `);
}

/**
 * Function to convert the given date to the start and end of the day in UTC
 * 
 * The reason for the function is because when the user inputs a date that
 * they would like to filter by, the date they selected encounts for the entire day.
 * This means that any request done in that day from 00:00:00 to 23:59:59 should
 * show up in their filtered results when the Query is sent to the database.
 * The issue that arrises is that we are assuing the database is in EST but it is actually
 * in UTC. What this means is that a request submitted at 10:00 PM EST on the 8th is 
 * recorded in the database as 3:00 AM UTC on the 9th. So when we filter by the 8th, we will
 * not receive that request in our results even though it was done on the 8th. The solution
 * we came up with was to store the start time and end time of the user selected date in EST
 * and then to convert that time to UTC. So this means that the start of the day in EST which
 * would be 00:00:00 is now represented as 05:00:00. The same was done for the end of day. This 
 * solved our issues because now when the query was being completed, it was looking for our
 * desired timeframe on the same timeZone as the database.. So that request that was
 * submitted at 10:00 PM is now showing up in our results.
 * 
 * @param dateVal the date in the format YYYY-MM-DD to get the startand end of the day
 * @returns an Object containing the start and end of the day in UTC
 */
function getStartAndEndOfDayInUTC(dateVal) {
    // Convert dateVal (e.g., "2024-12-02") to start and end of the day in EST (Eastern Standard Time)
    const startOfDayEST = new Date(`${dateVal}T00:00:00-05:00`);  // Start of the day (EST)
    const endOfDayEST = new Date(`${dateVal}T23:59:59-05:00`);    // End of the day (EST)

    // Convert to UTC and format to 'YYYY-MM-DD HH:mm:ss'
    const startOfDayUTC = startOfDayEST.toISOString().slice(0, 19).replace('T', ' ');
    const endOfDayUTC = endOfDayEST.toISOString().slice(0, 19).replace('T', ' ');

    return { startOfDayUTC, endOfDayUTC };
}

/**
 * Function to format the UTC datetime to EST in the
 * string format MM/DD/YYYY 00:00:00(EST) AM/PM
 * 
 * @param datetime the input datetime in UTC
 * @returns the formatted datetime in EST
 */
function formatToEST(datetime) {
    // Converts the partially completed UTC datetime to a UTC date object
    // This will allow us to perform further operations on the date
    const utcDate = new Date(datetime + " UTC");

    // These options specifify the format we want for our desired date
    // These options are telling it to include the year, month, day,
    // hour, minutes, seconds, AM/PM and to set the timezone to EST
    const options = {
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true,
        timeZone: 'America/New_York'
    };

    // Converts the current UTC date to the MM/DD/YYYY 00:00:00(EST) AM/PM format
    const estDate = utcDate.toLocaleString('en-US', options).replace(",", "");

    // Returns the formatted string
    return estDate;
}

/**
 * Function to reset the selected filter options
 * whenever the clear button is pressed
 */
function resetFilters() {
    $("#date").val('');
    $("#numRec").val('');
    $("input[name='sortOrder']").prop("checked", false);
}

/**
 * Function to get the current date in YYYY-MM-DD format for the EST timezone
 * 
 * @returns The current date in YYYY-MM-DD format (EST)
 */
function getCurrentDate() {
    // Creates a new Date object that represents the current date and time but in the UTC timezone
    const currentUTCDate = new Date();

    // These options specifify the format we want for our desired date
    // These options are telling it to include the year, month, day,
    // and to adjust the date to EST
    const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        timeZone: 'America/New_York' 
    };
    
    // Converts the current UTC date to the MM/DD/YYYY format in EST
    const estDate = currentUTCDate.toLocaleDateString('en-US', options);
    
    // Splits the date (MM/DD/YYYY) into individual components and stores them
    const [month, day, year] = estDate.split('/');
    // Returns the date in the desired format of YYYY-MM-DD
    return `${year}-${month}-${day}`;
}

/**
 * Function to get the user inputed value for the sorting
 * order if one was selected
 * 
 * @returns the user inputed value for the sorting order
 *           if one was selected
 */
function getSortOrder() {
    return $('#checkBox input[name="sortOrder"]:checked').val();
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
