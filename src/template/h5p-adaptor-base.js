// end of settings

//
//important variables
//

// const fetch = require('node-fetch');
const https = require('https');
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
// var testPHP = function ()
// {
//   var ajaxRequest = new XMLHttpRequest();

//   ajaxRequest.onreadystatechange = function()
//   {
//     if(ajaxRequest.readyState == 4)
//     {
//       console.log("PHP RESULT: ", ajaxRequest.responseText);
//     }
//   }

//   ajaxRequest.open("GET", "test.php", true);
//   ajaxRequest.send(null); 
// };

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

var saveStatementToLRS = function (event)
{

  fetch(' https://lrs-forwarder.herokuapp.com/LRSforwarder', {
    method: "POST",
    body: JSON.stringify(event),
    headers: { "Content-Type": "application/json" }
    // headers: { 'Access-Control-Allow-Origin': '*'},
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
//   data = JSON.stringify(event)

//   const options = 
//   {
//     hostname: 'https://lrs-forwarder.herokuapp.com',
//     path: '/LRSforwarder',
//     method: 'POST',
//     headers: 
//     {
//       'Content-Type': 'application/json',
//       'X-Experience-API-Version': '1.0.3',
//       'Access-Control-Allow-Origin': '*'
//     }
//   }

//   const req = https.request(options, res => 
//   {
//     console.log(`statusCode: ${res.statusCode}`)

//     res.on('data', d => 
//     {
//       console.log('Result ' + d)
//     })
//   })

//   req.on('error', error => 
//   {
//     console.error(error)
//   })

//   req.write(data)
//   req.end()

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