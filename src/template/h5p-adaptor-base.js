// end of settings

//
//important variables
//
// var adl = require('adl-xapiwrapper');
var TinCan = require('tincanjs');

var scorm = pipwerks.SCORM;

var numberOfQuestions = 0;
var isFirstAttempt = true;
const branchingFinalScoreID = "http://h5p.org/libraries/H5P.BranchingScenario-1.2";
var isFreshSession = true;

var seperateNumberOfQuestions = 0;
var seperateScore = 0;
var seperateMinScore = 0;
var seperateMaxScore = 0;
var seperateScaledScore = 0;

// var script = document.createElement("script");
// script.src = './dist/xapiwrapper.min.js'; 
// document.head.appendChild(script);

// var XAPIWrapper = require("./xapiwrapper");

var lrs;

try
{
	lrs = new TinCan.LRS
	({
		endpoint: "http://127.0.0.1:3000/data/xAPI/statements/",
		username: "07936372ee21ec6e03471362062040fac511eddb",
		password: "f761e6384c9956b722f576568e2543dee1833825",
		allowFail: false
	});
}
catch (err)
{
	console.log("Failed to created LRS object: ", err);
}

// var conf = {
//   "endpoint" : "https://lrs.adlnet.gov/xapi/",
//   "user" : "CIjoe",
//   "password" : "blueberry",
// };
// ADL.XAPIWrapper.changeConfig(conf);


function init() {
  scorm.init();
}

function set(param, value) {
  scorm.set(param, value);
}

function get(param) {
  scorm.get(param);
}

function end() {
  scorm.quit();
}

window.onload = function () {
  init();
};

window.onunload = function () {
  end();
};

//
//handle event here
//

H5P.externalDispatcher.on('xAPI', function (event) {

  console.log('xAPI event: ' + JSON.stringify(event));
  
  // if(lrs !== null)
  saveStatementToLRS(event);

  if(isFreshSession)
    checkForPreviousAttempts();

  if (isGradable(event))
  {

    if(isBranchingFinalScore(event))
    {
      console.log('This is the final branching score!');
      if(gradeBranchingScore())
        onAnswered(event.data.statement.result, true);
      
      isFirstAttempt = false;
    }
    else
    {
      console.log('This is a normal question');
      if(isIndividualQuestion(event) && gradeQuestions())
        onAnswered(event.data.statement.result, false);
      
    }
  }
});

//
// supporting functions
//

var isGradable = function (event)
{
  return event.data.statement.result;
};

var isBranchingFinalScore = function (event)
{
  return event.data.statement && event.data.statement.context && event.data.statement.context.contextActivities && 
  event.data.statement.context.contextActivities.category &&
  (branchingFinalScoreID.localeCompare(event.data.statement.context.contextActivities.category[0].id) == 0);
};

var isIndividualQuestion = function (event)
{
  return event.data.statement.object.definition.description;
};

var gradeQuestions = function ()
{
  return (gradingMethod.localeCompare("Question") == 0) || (gradingMethod.localeCompare("Both") == 0);
};

var gradeBranchingScore = function ()
{
  return (gradingMethod.localeCompare("Branching") == 0) || (gradingMethod.localeCompare("Both") == 0);
};

var isIndividualQuestion = function (event)
{
  return event.data.statement.object.definition.description;
};

var isAverageRedoPolicy = function ()
{
  return (redoPolicy.localeCompare("Average") == 0);
};

var isFirstRedoPolicy = function ()
{
  return (redoPolicy.localeCompare("First") == 0);
};

var isHighestRedoPolicy = function ()
{
  return (redoPolicy.localeCompare("Highest") == 0);
};

var isRecentRedoPolicy = function ()
{
  return (redoPolicy.localeCompare("Recent") == 0);
};


var onAnswered = function (result, isEnd)
{
  if(isFirstAttempt)
  {
    gradeNormally(result);
  }
  else if (isAverageRedoPolicy)
  {
    gradeNormally(result);
  }
  else if (isFirstRedoPolicy)
  {
    console.log('Not first attempt; Not grading');
  }
  else if (isHighestRedoPolicy)
  {
    gradeSeperately(result);
    if(isEnd)
      updateScoreToHighest();
  }
  else if (isRecentRedoPolicy)
  {
    gradeSeperately(result);
    if(isEnd)
      updateScoreToMostRecent();
  }
  
};

var gradeNormally = function (result)
{
  numberOfQuestions++;

  var previousRaw = scorm.get("cmi.core.score.raw");
  var previousMin = scorm.get("cmi.core.score.min");
  var previousMax = scorm.get("cmi.core.score.max");
  var previousScaled = scorm.get("cmi.core.score.scaled");

  var newScaledScore = 0;

  if(previousRaw)
  {
    scorm.set("cmi.core.score.raw", Number(previousRaw) + Number(result.score.raw));
    scorm.set("cmi.core.score.min", Number(previousMin) + Number(result.score.min));
    scorm.set("cmi.core.score.max", Number(previousMax) + Number(result.score.max));

    newScaledScore = (Number(previousRaw) + Number(result.score.raw))/Number(numberOfQuestions);
    scorm.set("cmi.core.score.scaled", newScaledScore);
  }
  else
  {
    scorm.set("cmi.core.score.raw", Number(result.score.raw));
    scorm.set("cmi.core.score.min", Number(result.score.min));
    scorm.set("cmi.core.score.max", Number(result.score.max));

    newScaledScore = Number(result.score.raw);
    scorm.set("cmi.core.score.scaled", newScaledScore);
  }

  handleMasteryScore(newScaledScore);
};

var handleMasteryScore = function (newScaledScore)
{
  var masteryScore;
  if (scorm.version == "2004")
    masteryScore = scorm.get("cmi.scaled_passing_score");
  else if (scorm.version == "1.2")
    masteryScore = scorm.get("cmi.student_data.mastery_score") / 100;
  
  if (masteryScore === undefined)
    scorm.status("set", "completed");
  else 
  {
    var passed = newScaledScore >= masteryScore;
    if (scorm.version == "2004") 
    {
      scorm.status("set", "completed");
      if (passed)
        scorm.set("cmi.success_status", "passed");
      else
        scorm.set("cmi.success_status", "failed");
    }
    else if (scorm.version == "1.2") 
    {
      if (passed)
        scorm.status("set", "passed");
      else
        scorm.status("set", "failed");
    }
  }
};

var gradeSeperately = function (result)
{
  seperateNumberOfQuestions++;

  seperateScore += Number(result.score.raw);
  seperateMinScore += Number(result.score.min);
  seperateMaxScore += Number(result.score.max);
  seperateScaledScore = Number(seperateScore/seperateMaxScore);

  handleMasteryScore(newScaledScore);
};

var updateScoreToHighest = function ()
{
  var currentScore = scorm.get("cmi.core.score.raw");
  if(seperateScore > currentScore)
  {
    scorm.set("cmi.core.score.raw", seperateScore);
    scorm.set("cmi.core.score.min", seperateMinScore);
    scorm.set("cmi.core.score.max", seperateMaxScore);
    scorm.set("cmi.core.score.scaled", seperateScaledScore);
  }

  resetScores();
};

var updateScoreToMostRecent = function ()
{
  scorm.set("cmi.core.score.raw", seperateScore);
  scorm.set("cmi.core.score.min", seperateMinScore);
  scorm.set("cmi.core.score.max", seperateMaxScore);
  scorm.set("cmi.core.score.scaled", seperateScaledScore);

  resetScores();
};

var resetScores = function ()
{
  seperateNumberOfQuestions = 0;
  seperateScore = 0;
  seperateMaxScore = 0;
  seperateScaledScore = 0;
};

var checkForPreviousAttempts = function ()
{
  var storedScore = scorm.get("cmi.core.score.raw");
  isFirstAttempt = (storedScore.length == 0);

  console.log("Fresh session: " + isFirstAttempt);

  isFreshSession = false;
};

// var saveStatementToLRS = function (event)
// {
//   var statement = new TinCan.Statement(event);
// 	lrs.saveStatement(statement, 
// 	{
// 		callback: function(err, xhr) 
// 		{
// 			if(err !== null)
// 			{
// 				if (xhr !== null)
// 				{
// 					console.log("Failed to save xAPI statement: " + xhr.responseText + " (" + xhr.status + ")");
// 					return;
// 				}

// 				console.log("Failed to save xAPI statement: " + err);
// 				return;
// 			}

//       console.log("xAPI statement saved to LRS successfully");
// 		}

// 	}
// 	);
// };

var saveStatementToLRS = function (event)
{
  fetch('http://127.0.0.1:3000/data/xAPI/statements', {
    method: "POST",
    body: event,
    headers: {Authorization: "Basic MDc5MzYzNzJlZTIxZWM2ZTAzNDcxMzYyMDYyMDQwZmFjNTExZWRkYjpmNzYxZTYzODRjOTk1NmI3MjJmNTc2NTY4ZTI1NDNkZWUxODMzODI1",
    Access-Control-Allow-Origin: "*"}
  }).then(function(response) 
  {
    return response.json();
  }).then(function(result)
  {
    console.log('Attempted xAPI save: ', result);
  });
};

// var saveStatementToLRS = function (event)
// {
// 	var resp_obj = ADL.XAPIWrapper.sendStatement(event);
// 	ADL.XAPIWrapper.log("[" + resp_obj.id + "]: " + resp_obj.xhr.status + " - " + resp_obj.xhr.statusText);
// };

// unused

var followsRedoPolicy = function ()
{
  return (!isFirstRedoPolicy() || (isFirstRedoPolicy() && isFirstAttempt));
};

var onCompleted = function (result) {
  var masteryScore;
  if (scorm.version == "2004") {
    masteryScore = scorm.get("cmi.scaled_passing_score");
  } else if (scorm.version == "1.2") {
    masteryScore = scorm.get("cmi.student_data.mastery_score") / 100;
  }

  scorm.set("cmi.core.score.raw", result.score.raw);
  scorm.set("cmi.core.score.min", result.score.min);
  scorm.set("cmi.core.score.max", result.score.max);
  scorm.set("cmi.core.score.scaled", result.score.scaled);

  if (masteryScore === undefined) {
    scorm.status("set", "completed");
  }
  else {
    var passed = result.score.scaled >= masteryScore;
    if (scorm.version == "2004") {
      scorm.status("set", "completed");
      if (passed) {
        scorm.set("cmi.success_status", "passed");
      }
      else {
        scorm.set("cmi.success_status", "failed");
      }
    }
    else if (scorm.version == "1.2") {
      if (passed) {
        scorm.status("set", "passed");
      }
      else {
        scorm.status("set", "failed");
      }
    }
  }
};