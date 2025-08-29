<?php
class final_rest
{



        /**
         * @api  /api/v1/getLevel/
         * @apiName getLevel
         * @apiDescription Return all level data from database
         *
         * @apiSuccess {Integer} status
         * @apiSuccess {string} message
         *
         * @apiSuccessExample Success-Response:
         *     HTTP/1.1 200 OK
         *     {
         *              "status":0,
         *              "message": ""
         *              "result": [
         *                { 
         *                  levelID: 1,
         *                  description: "",
         *                  prompt: ""
         *              ]
         *     }
         *
         * @apiError Invalid data types
         *
         * @apiErrorExample Error-Response:
         *     HTTP/1.1 200 OK
         *     {
         *              "status":1,
         *              "message":"Error Message"
         *     }
         *
         */
        public static function getLevel()
        {

                try {
                        $retData["result"] = GET_SQL('select * from level order by sortCode');
                        $retData["status"] = 0;
                        $retData["message"] = "Get Level was successful!";
                } catch (Exception $e) {
                        $retData["status"] = 1;
                        $retData["message"] = "Error Getting Levels: " . $e->getMessage();
                }

                return json_encode($retData);
        }

        /**
         * @api  /api/v1/addLog/
         * @apiName addLog
         * @apiDescription Add record to logfile
         *
         * @apiParam {JSON String} input
         * @apiParam {JSON String} output
         * 
         * Format:
         * input: {
         *      userPrompt: userPrompt
         *      systemPrompt: userDescription,
         * },
         * output: {
         *      aiResponse: aiResponse
         *      promptTokens: promptTokens
         *      completionTokens: completionTokens
         * }
         * 
         *
         * @apiSuccess {Integer} status
         * @apiSuccess {string} message
         *
         * @apiSuccessExample Success-Response:
         *     HTTP/1.1 200 OK
         *     {
         *              "status":0,
         *              "message": ""
         *     }
         *
         * @apiError Invalid data types
         *
         * @apiErrorExample Error-Response:
         *     HTTP/1.1 200 OK
         *     {
         *              "status":1,
         *              "message":"Error Message"
         *     }
         *
         */
        public static function addLog($input, $output)
        {
                $inputJson = json_encode($input);
                $outputJson = json_encode($output);

                try {
                        EXEC_SQL("insert into log (input, output) values (?,?)", $inputJson, $outputJson);
                        $retData["status"] = 0;
                        $retData["message"] = "Accepeted";
                } catch (Exception $e) {
                        $retData["status"] = 1;
                        $retData["message"] = "Error AddingLog: " . $e->getMessage();
                }

                return json_encode($retData);
        }


        /**
         * @api  /api/v1/getLog/
         * @apiName getLog
         * @apiDescription Retrieve Log Records
         *
         * @apiParam {string} date
         * @apiParam {String} numRecords
         *
         * @apiSuccess {Integer} status
         * @apiSuccess {string} message
         *
         * @apiSuccessExample Success-Response:
         *     HTTP/1.1 200 OK
         *     {
         *              "status":0,
         *              "message": ""
         *              "result": [
         *                { 
         *                  datetime: "YYYY-MM-DD HH:MM:SS",
         *                  logid: "",
         *                  input: 0,
         *                  output: 0
         *              ]
         *     }
         *
         * @apiError Invalid data types
         *
         * @apiErrorExample Error-Response:
         *     HTTP/1.1 200 OK
         *     {
         *              "status":1,
         *              "message":"Error Message"
         *     }
         *
         */
        public static function getLogSummary($date, $numrecords)
        {
                try {
                        $retData["result"] = GET_SQL("select * from log where DATE(datetime) = ? limit ?", $date, $numrecords);
                        $retData["status"] = 0;
                        $retData["message"] = "Get Log Summary  was successful!";
                } catch (Exception $e) {
                        $retData["status"] = 1;
                        $retData["message"] = "Error Getting Log Summary: " . $e->getMessage();
                }

                return json_encode($retData);
        }

        /**
         * @api /api/v1/displayLog/
         * @apiName displayLog
         * @apiDescription Retrieve all log records ordered the most recent
         * 
         * @apiSuccess {Integer} status
         * @apiSuccess {string} message
         * 
         * @apiSuccessExample Success-Response:
         *      HTTP/1.1 200 OK
         * {
         *      "status":0.
         *      "message":"",
         *      "result": [
         *                { 
         *                  datetime: "YYYY-MM-DD HH:MM:SS",
         *                  logid: "",
         *                  input: 0,
         *                  output: 0
         *              ]
         * }
         * 
         * @apiError Invalid data types
         * 
         * @apiErrorExample Error-Response:
         *     HTTP/1.1 200 OK
         *     {
         *              "status":1,
         *              "message":"Error Message"
         *     }
         */
        public static function displayLog()
        {
                try {
                        $retData["result"] = GET_SQL("select * from log order by datetime desc");
                        $retData["status"] = 0;
                        $retData["message"] = "Get Display Log was successful!";
                } catch (Exception $e) {
                        $retData["status"] = 1;
                        $retData["message"] = "Error Displaying Log: " . $e->getMessage();
                }

                return json_encode($retData);
        }


        /**
         * @api /api/v1/filterLog/
         * @apiName filterLog
         * @apiDescription Filters log records by a dynamically created query
         * 
         * @apiSuccess {Integer} status
         * @apiSuccess {string} message
         * 
         * @apiSuccessExample Success-Response:
         *      HTTP/1.1 200 OK
         * {
         *      "status":0.
         *      "message":"",
         *      "result": [
         *                { 
         *                  datetime: "YYYY-MM-DD HH:MM:SS",
         *                  logid: "",
         *                  input: 0,
         *                  output: 0
         *              ]
         * }
         * 
         * @apiError Invalid data types
         * 
         * @apiErrorExample Error-Response:
         *     HTTP/1.1 200 OK
         *     {
         *              "status":1,
         *              "message":"Error Message"
         *     }
         */
        public static function filterLog($query)
        {
                try {
                        $retData["result"] = GET_SQL($query);
                        $retData["status"] = 0;
                        $retData["message"] = "Get Display Log was successful!";
                } catch (Exception $e) {
                        $retData["status"] = 1;
                        $retData["message"] = "Error Displaying Log: " . $e->getMessage();
                }

                return json_encode($retData);
        }
}
